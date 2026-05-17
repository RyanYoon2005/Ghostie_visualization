import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShareIcon from '@mui/icons-material/Share';
import CheckIcon from '@mui/icons-material/Check';
import {
  Area, Bar, BarChart, Line, CartesianGrid, ComposedChart, Legend,
  ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis,
} from 'recharts';
import { SentimentBadge } from '../components/SentimentBadge';
import { API } from '../api/config';
import { readSnapshotFromHash, clearSnapshotHash, formatSnapshotDate } from '../utils/snapshot';

// One colour per company slot — same palette as Premium Analysis.
const SERIES_COLORS = [
  'hsl(95, 35%, 38%)',
  'hsl(20, 65%, 48%)',
  'hsl(210, 50%, 40%)',
  'hsl(42, 75%, 45%)',
  'hsl(280, 35%, 45%)',
];

const sourceLabel = (s) => {
  if (s === 'google_maps_reviews') return 'Review';
  if (s === 'newsapi') return 'News';
  if (s === 'reddit') return 'Reddit';
  if (s === 'google_news_rss') return 'Google News';
  return s || '—';
};

// Public read — falls back to a stored token if the visitor happens to be signed in.
function publicFetch(path) {
  const token = (() => {
    try {
      const accounts = JSON.parse(localStorage.getItem('ghostie_accounts') || '[]');
      return accounts[0]?.token ?? null;
    } catch { return null; }
  })();
  return fetch(`${API.middleware}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

const toIso = (d) => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

const toDateLabel = (iso) =>
  new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit' });

const fadeUp = (delay = 0) => ({
  '@keyframes fadeUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to:   { opacity: 1, transform: 'translateY(0)' },
  },
  animation: `fadeUp 0.5s ease ${delay}s both`,
});

// Load history + sentiment + stock for a single company. Resolves to null on failure
// so a single bad URL entry doesn't block the rest of the comparison.
async function loadCompany({ business_name, location, category }, color) {
  const params = new URLSearchParams({ business_name, location, category });
  const stockParams = new URLSearchParams({ business_name });

  const [historyRes, sentimentRes, stockRes] = await Promise.all([
    publicFetch(`/analytical-model/history?${params}`),
    publicFetch(`/analytical-model/sentiment?${params}`),
    publicFetch(`/data-collection/stock?${stockParams}`).catch(() => null),
  ]);

  if (!historyRes.ok) return null;
  const history = await historyRes.json();
  if (history.detail) return null;

  const sentimentByIso = new Map();
  history.results.forEach((r) => {
    const iso = toIso(r.date_time);
    if (iso) sentimentByIso.set(iso, r.overall_score);
  });
  const data = Array.from(sentimentByIso.entries()).map(([iso, score]) => ({ iso, score }));

  let snapshot = null;
  if (sentimentRes.ok) {
    const sj = await sentimentRes.json();
    if (!sj.detail) snapshot = sj;
  }

  let stock = null;
  if (stockRes && stockRes.ok) {
    const sj = await stockRes.json().catch(() => ({}));
    if (sj.price_history?.length) {
      stock = sj.price_history
        .map((p) => ({ iso: toIso(p.date), close: p.close }))
        .filter((p) => p.iso);
    }
  }

  return {
    key: history.business_key,
    label: business_name,
    location,
    category,
    color,
    data,
    stock,
    snapshot,
    results: history.results,
  };
}

export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Parse URL params: each `c=` is `name|location|category`.
  const requestedCompanies = useMemo(() => {
    const cs = searchParams.getAll('c');
    return cs.map((raw) => {
      const [business_name, location = '', category = ''] = raw.split('|');
      return { business_name, location, category };
    }).filter((c) => c.business_name);
  }, [searchParams]);

  // Pull an embedded snapshot synchronously (if any) so we can render instantly.
  const initialSnapshot = useState(() => readSnapshotFromHash())[0];

  const [companies, setCompanies] = useState(initialSnapshot?.companies ?? []);
  const [loading, setLoading] = useState(!initialSnapshot && requestedCompanies.length > 0);
  const [error, setError] = useState(() => {
    if (initialSnapshot) return '';
    if (requestedCompanies.length === 0) return 'No companies specified in the URL.';
    return '';
  });
  const [showSentiment, setShowSentiment] = useState(true);
  const [showStock, setShowStock] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [shareCopied, setShareCopied] = useState(false);
  const [snapshotDate, setSnapshotDate] = useState(initialSnapshot?.snapshotDate ?? null);
  const isSnapshot = !!snapshotDate;

  useEffect(() => {
    // Snapshot already populated the companies array — skip the network entirely.
    if (initialSnapshot) {
      document.title = `Comparing ${(initialSnapshot.companies ?? []).map((c) => c.label).join(' vs ')} — Ghostie`;
      return () => { document.title = 'Ghostie'; };
    }
    if (requestedCompanies.length === 0) return;
    document.title = `Comparing ${requestedCompanies.map((c) => c.business_name).join(' vs ')} — Ghostie`;

    Promise.all(
      requestedCompanies.slice(0, SERIES_COLORS.length).map((c, i) =>
        loadCompany(c, SERIES_COLORS[i])
      )
    ).then((results) => {
      const loaded = results.filter(Boolean);
      if (loaded.length === 0) {
        setError('None of the requested companies have data available.');
      }
      setCompanies(loaded);
    }).catch(() => setError('Could not load comparison data.')).finally(() => setLoading(false));

    return () => { document.title = 'Ghostie'; };
  }, [requestedCompanies, initialSnapshot]);

  // "View live data" — drop the snapshot fragment and re-fetch from the API.
  const handleViewLive = () => {
    clearSnapshotHash();
    setSnapshotDate(null);
    setCompanies([]);
    setLoading(true);
    Promise.all(
      requestedCompanies.slice(0, SERIES_COLORS.length).map((c, i) =>
        loadCompany(c, SERIES_COLORS[i])
      )
    ).then((results) => {
      const loaded = results.filter(Boolean);
      if (loaded.length === 0) setError('None of the requested companies have data available.');
      setCompanies(loaded);
    }).catch(() => setError('Could not load comparison data.')).finally(() => setLoading(false));
  };

  // — Derived data —

  const chartData = useMemo(() => {
    if (companies.length === 0) return [];
    const indexed = companies.map((c) => ({
      key: c.key,
      sentimentMap: new Map(c.data.map((d) => [d.iso, d.score])),
      stockMap: new Map((c.stock ?? []).map((d) => [d.iso, d.close])),
    }));
    const allIsos = new Set();
    indexed.forEach((c) => {
      c.sentimentMap.forEach((_, iso) => allIsos.add(iso));
      c.stockMap.forEach((_, iso) => allIsos.add(iso));
    });
    return Array.from(allIsos).sort().map((iso) => {
      const row = { iso, date: toDateLabel(iso) };
      indexed.forEach((c) => {
        row[c.key] = c.sentimentMap.has(iso) ? c.sentimentMap.get(iso) : null;
        row[`${c.key}_stock`] = c.stockMap.has(iso) ? c.stockMap.get(iso) : null;
      });
      return row;
    });
  }, [companies]);

  const anyStock = companies.some((c) => c.stock?.length > 0);

  const filteredChartData = useMemo(() => {
    if (dateRange === 'all' || chartData.length === 0) return chartData;
    const days = dateRange === '7d' ? 7 : 30;
    return chartData.slice(-days);
  }, [chartData, dateRange]);

  const leaderboard = useMemo(() => companies
    .map((c) => ({
      key: c.key,
      label: c.label,
      color: c.color,
      score: c.snapshot?.overall_score ?? null,
      rating: c.snapshot?.overall_rating ?? null,
      keywords: c.snapshot?.keyword_split ?? null,
      flatKeywords: c.snapshot?.keywords ?? [],
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1)), [companies]);

  const sourceChartData = useMemo(() => {
    const sourcesPresent = new Set();
    const perCompany = new Map();
    companies.forEach((c) => {
      const grouped = new Map();
      (c.snapshot?.breakdown ?? []).forEach((item) => {
        sourcesPresent.add(item.source);
        const slot = grouped.get(item.source) ?? { total: 0, n: 0 };
        slot.total += item.score;
        slot.n += 1;
        grouped.set(item.source, slot);
      });
      const avgBySource = {};
      grouped.forEach((v, k) => { avgBySource[k] = Math.round(v.total / v.n); });
      perCompany.set(c.key, avgBySource);
    });
    const ordered = ['google_maps_reviews', 'newsapi', 'google_news_rss', 'reddit']
      .filter((s) => sourcesPresent.has(s));
    return ordered.map((src) => {
      const row = { source: sourceLabel(src) };
      companies.forEach((c) => {
        const avg = perCompany.get(c.key)?.[src];
        if (avg != null) row[c.key] = avg;
      });
      return row;
    });
  }, [companies]);

  const handleShare = async () => {
    try { await navigator.clipboard.writeText(window.location.href); } catch { /* no-op */ }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'hsl(40,30%,88%)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar — same look as the public scorecard */}
      <Box sx={{
        px: { xs: 2, md: 4 }, py: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid hsl(35,20%,72%)',
        bgcolor: 'hsl(40,30%,94%)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: 2,
            background: 'linear-gradient(135deg, hsl(15,45%,45%), hsl(35,45%,45%))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AnalyticsIcon sx={{ fontSize: 19, color: 'hsl(40,30%,88%)' }} />
          </Box>
          <Typography fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)', fontSize: 18 }}>
            Ghostie
          </Typography>
          <Typography variant="caption" sx={{ color: 'hsl(0,0%,45%)', display: { xs: 'none', sm: 'block' } }}>
            Business Comparison
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          endIcon={<OpenInNewIcon sx={{ fontSize: 17 }} />}
          onClick={() => navigate('/signin')}
        >
          Sign in to build your own
        </Button>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, maxWidth: 1200, mx: 'auto', width: '100%', px: { xs: 2, md: 4 }, py: 4 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
            <CircularProgress sx={{ color: 'hsl(15,45%,45%)' }} />
          </Box>
        )}

        {error && !loading && (
          <Box sx={{ mt: 4 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {!loading && companies.length > 0 && (
          <>
            {/* Heading + share */}
            <Box sx={{ ...fadeUp(0), display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
              <Box>
                <Typography variant="h4" fontWeight={800} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)', lineHeight: 1.25 }}>
                  {companies.map((c) => c.label).join(' vs ')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)', mt: 0.5 }}>
                  Sentiment, stock price and source breakdown — side by side.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={shareCopied ? <CheckIcon /> : <ShareIcon />}
                onClick={handleShare}
                sx={{
                  color: shareCopied ? 'hsl(95,25%,32%)' : undefined,
                  borderColor: shareCopied ? 'hsl(95,25%,42%)' : undefined,
                }}
              >
                {shareCopied ? 'Link copied' : 'Share this comparison'}
              </Button>
            </Box>

            {/* Snapshot notice */}
            {isSnapshot && (
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 1, mb: 3, color: 'hsl(0,0%,30%)',
              }}>
                <Typography variant="caption" sx={{ fontSize: 14 }}>
                  📌 Snapshot from {formatSnapshotDate(snapshotDate)} — the data below was captured at that time.
                </Typography>
                {requestedCompanies.length > 0 && (
                  <Box
                    component="button"
                    type="button"
                    onClick={handleViewLive}
                    sx={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontFamily: 'inherit',
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'hsl(15,45%,38%) !important',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                      cursor: 'pointer',
                      '&:hover': { color: 'hsl(15,45%,28%) !important' },
                    }}
                  >
                    View live data
                  </Box>
                )}
              </Box>
            )}

            {/* Mini leaderboard + source comparison */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3, ...fadeUp(0.07) }}>
              <Box sx={{ borderRadius: '12px', border: '1px solid hsl(35,20%,78%)', bgcolor: 'hsl(40,35%,96%)', overflow: 'hidden' }}>
                <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid hsl(35,20%,78%)', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmojiEventsIcon sx={{ fontSize: 19, color: 'hsl(38,55%,32%)' }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                      Leaderboard
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }}>
                      Latest sentiment scores + top keywords
                    </Typography>
                  </Box>
                </Box>
                {leaderboard.map((c, i) => (
                  <Box key={c.key} sx={{
                    px: 2.5, py: 2,
                    borderBottom: i < leaderboard.length - 1 ? '1px solid hsl(35,20%,78%)' : 'none',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      <Box sx={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 14,
                        bgcolor: `${c.color}22`, color: c.color, border: `1px solid ${c.color}55`,
                      }}>{i + 1}</Box>
                      <Typography variant="body1" fontWeight={600} sx={{ color: 'hsl(0,0%,12%)', flex: 1, minWidth: 0 }} noWrap>
                        {c.label}
                      </Typography>
                      {c.score != null
                        ? <SentimentBadge score={c.score} size="sm" />
                        : <Typography variant="caption" sx={{ color: 'hsl(0,0%,45%)' }}>No data</Typography>}
                    </Box>
                    {c.keywords && (c.keywords.positive?.length || c.keywords.negative?.length) ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 4.25 }}>
                        {c.keywords.positive?.slice(0, 5).map((kw) => (
                          <Chip key={`p-${kw}`} label={`+ ${kw}`} size="small" sx={{
                            bgcolor: 'rgba(120,135,90,0.14)', color: 'hsl(95,25%,28%)',
                            border: '1px solid rgba(120,135,90,0.30)', height: 22, fontSize: 13,
                          }} />
                        ))}
                        {c.keywords.negative?.slice(0, 5).map((kw) => (
                          <Chip key={`n-${kw}`} label={`− ${kw}`} size="small" sx={{
                            bgcolor: 'rgba(180,80,60,0.10)', color: 'hsl(10,50%,32%)',
                            border: '1px solid rgba(180,80,60,0.30)', height: 22, fontSize: 13,
                          }} />
                        ))}
                      </Box>
                    ) : c.flatKeywords.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 4.25 }}>
                        {c.flatKeywords.slice(0, 6).map((kw) => (
                          <Chip key={kw} label={kw} size="small" sx={{
                            bgcolor: 'rgba(0,0,0,0.04)', color: 'hsl(0,0%,25%)',
                            border: '1px solid hsl(35,20%,78%)', height: 22, fontSize: 13,
                          }} />
                        ))}
                      </Box>
                    ) : null}
                  </Box>
                ))}
              </Box>

              <Box sx={{ borderRadius: '12px', border: '1px solid hsl(35,20%,78%)', bgcolor: 'hsl(40,35%,96%)', overflow: 'hidden' }}>
                <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid hsl(35,20%,78%)', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BarChartIcon sx={{ fontSize: 19, color: 'hsl(210,50%,40%)' }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                      Source Comparison
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }}>
                      Average score per source — one bar per company
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ p: 2 }}>
                  {sourceChartData.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'hsl(0,0%,45%)', textAlign: 'center', py: 4 }}>
                      No source breakdown available.
                    </Typography>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={Math.max(220, 60 * sourceChartData.length + 60)}>
                        <BarChart data={sourceChartData} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(35,20%,78%)" vertical={false} />
                          <XAxis dataKey="source" stroke="hsl(0,0%,35%)" tick={{ fill: 'hsl(0,0%,35%)', fontSize: 14 }} />
                          <YAxis domain={[0, 100]} stroke="hsl(0,0%,35%)" tick={{ fill: 'hsl(0,0%,35%)', fontSize: 13 }} width={36} />
                          <ReTooltip
                            contentStyle={{ backgroundColor: 'hsl(40,35%,96%)', border: '1px solid hsl(35,20%,78%)', borderRadius: 8, color: 'hsl(0,0%,12%)' }}
                            formatter={(value, key) => {
                              const co = companies.find((c) => c.key === key);
                              return [`${value}/100`, co ? co.label : key];
                            }}
                          />
                          {companies.map((c) => (
                            <Bar key={c.key} dataKey={c.key} fill={c.color} radius={[4, 4, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, mt: 1 }}>
                        {companies.map((c) => (
                          <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: 2, bgcolor: c.color }} />
                            <Typography variant="caption" sx={{ color: 'hsl(0,0%,30%)' }}>{c.label}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Trend chart */}
            {chartData.length > 1 && (
              <Box sx={{
                borderRadius: '12px', border: '1px solid hsl(35,20%,78%)',
                bgcolor: 'hsl(40,35%,96%)', p: 3, ...fadeUp(0.12),
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                    Sentiment vs Stock Price
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <ToggleButtonGroup
                      value={dateRange}
                      exclusive
                      onChange={(_, v) => { if (v) setDateRange(v); }}
                      size="small"
                      sx={{
                        '& .MuiToggleButton-root': {
                          color: 'hsl(0,0%,35%)', border: '1px solid hsl(35,20%,78%)',
                          fontSize: 14, px: 1.5, py: 0.25,
                          '&.Mui-selected': { color: 'hsl(95,25%,42%)', bgcolor: 'rgba(120,135,90,0.12)', borderColor: 'rgba(120,135,90,0.25)' },
                        },
                      }}
                    >
                      <ToggleButton value="7d">7D</ToggleButton>
                      <ToggleButton value="30d">30D</ToggleButton>
                      <ToggleButton value="all">All</ToggleButton>
                    </ToggleButtonGroup>
                    <FormControlLabel
                      control={<Switch size="small" checked={showSentiment} onChange={(e) => setShowSentiment(e.target.checked)} />}
                      label={<Typography variant="caption" sx={{ color: 'hsl(0,0%,35%)' }}>Sentiment</Typography>}
                      sx={{ m: 0 }}
                    />
                    <FormControlLabel
                      control={<Switch size="small" checked={showStock} disabled={!anyStock} onChange={(e) => setShowStock(e.target.checked)} />}
                      label={<Typography variant="caption" sx={{ color: anyStock ? 'hsl(0,0%,35%)' : 'hsl(0,0%,55%)' }}>
                        Stock price{!anyStock ? ' (n/a)' : ''}
                      </Typography>}
                      sx={{ m: 0 }}
                    />
                  </Box>
                </Box>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={filteredChartData}>
                    <defs>
                      {companies.map((c) => (
                        <linearGradient key={c.key} id={`grad_${c.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={c.color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(35,20%,78%)" />
                    <XAxis dataKey="date" stroke="hsl(0,0%,35%)" tick={{ fill: 'hsl(0,0%,35%)', fontSize: 14 }} minTickGap={40} />
                    <YAxis yAxisId="sentiment" domain={[0, 100]} stroke="hsl(0,0%,35%)" tick={{ fill: 'hsl(0,0%,35%)', fontSize: 14 }} hide={!showSentiment} />
                    {showStock && anyStock && (
                      <YAxis
                        yAxisId="stock"
                        orientation="right"
                        domain={['dataMin', 'dataMax']}
                        stroke="hsl(0,0%,35%)"
                        tick={{ fill: 'hsl(0,0%,35%)', fontSize: 14 }}
                        tickFormatter={(v) => `$${Math.round(v)}`}
                      />
                    )}
                    <ReTooltip
                      contentStyle={{ backgroundColor: 'hsl(40,35%,96%)', border: '1px solid hsl(35,20%,78%)', borderRadius: '8px', color: 'hsl(0,0%,12%)' }}
                      labelStyle={{ color: 'hsl(0,0%,12%)', fontWeight: 600, marginBottom: 4 }}
                      formatter={(value, key) => {
                        if (typeof key !== 'string') return [value, key];
                        if (key.endsWith('_stock')) {
                          const co = companies.find((c) => `${c.key}_stock` === key);
                          return [`$${Number(value).toFixed(2)}`, co ? `${co.label} (stock)` : 'Stock'];
                        }
                        const co = companies.find((c) => c.key === key);
                        return [`${value}/100`, co ? `${co.label} (sentiment)` : 'Sentiment'];
                      }}
                    />
                    <Legend
                      wrapperStyle={{ color: 'hsl(0,0%,35%)', fontSize: 15, paddingTop: 12 }}
                      formatter={(value) => {
                        if (value.endsWith('_stock')) {
                          const co = companies.find((c) => `${c.key}_stock` === value);
                          return co ? `${co.label} (stock)` : value;
                        }
                        const co = companies.find((c) => c.key === value);
                        return co ? co.label : value;
                      }}
                    />
                    {showSentiment && companies.map((c) => (
                      <Area key={c.key} yAxisId="sentiment" type="monotone" dataKey={c.key} name={c.key}
                            stroke={c.color} fill={`url(#grad_${c.key})`} strokeWidth={2} dot={false}
                            activeDot={{ r: 4, fill: c.color }} connectNulls />
                    ))}
                    {showStock && anyStock && companies.map((c) => (
                      c.stock?.length ? (
                        <Line key={`${c.key}_stock`} yAxisId="stock" type="monotone" dataKey={`${c.key}_stock`}
                              name={`${c.key}_stock`} stroke={c.color} strokeWidth={1.75}
                              strokeDasharray="4 4" dot={false} activeDot={{ r: 3, fill: c.color }} connectNulls />
                      ) : null
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            )}
          </>
        )}
      </Box>

      <Divider sx={{ borderColor: 'hsl(35,20%,72%)' }} />
      <Box sx={{ px: 4, py: 2, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'hsl(0,0%,45%)' }}>
          Powered by <Box component="span" sx={{ color: 'hsl(15,45%,40%)', fontWeight: 600 }}>Ghostie</Box>
          {' '}— Public sentiment + market data. Scores update when new data is collected.
        </Typography>
      </Box>
    </Box>
  );
}
