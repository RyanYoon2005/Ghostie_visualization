import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TimelineIcon from '@mui/icons-material/Timeline';
import StarIcon from '@mui/icons-material/Star';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DownloadIcon from '@mui/icons-material/Download';
import ShareIcon from '@mui/icons-material/Share';
import CheckIcon from '@mui/icons-material/Check';
import SaveIcon from '@mui/icons-material/Save';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import {
  Area,
  Bar,
  BarChart,
  Line,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import BarChartIcon from '@mui/icons-material/BarChart';
import { SentimentBadge } from '../components/SentimentBadge';
import { StatsCard } from '../components/StatsCard';
import { makeApiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { BusinessPicker } from '../components/BusinessPicker';
import { useBusiness } from '../context/BusinessContext';
import { buildCsv, downloadCsv, safeFilename } from '../utils/csv';
import { buildSnapshotHash } from '../utils/snapshot';

// Distinct boutique palette — one colour per company slot. Hues are well-separated so
// adjacent series stay legible even when sentiment + stock lines overlap.
const SERIES_COLORS = [
  'hsl(95, 35%, 38%)',  // green   — sage
  'hsl(20, 65%, 48%)',  // orange  — burnt terracotta
  'hsl(210, 50%, 40%)', // blue    — deep dusty blue
  'hsl(42, 75%, 45%)',  // yellow  — mustard
  'hsl(280, 35%, 45%)', // purple  — muted aubergine
];

const sourceLabel = (s) => {
  if (s === 'google_maps_reviews') return 'Review';
  if (s === 'newsapi') return 'News';
  if (s === 'reddit') return 'Reddit';
  if (s === 'google_news_rss') return 'Google News';
  return s || '—';
};

// Linear regression over an array of numbers → returns predicted values at same indices
function linearRegression(values) {
  const n = values.length;
  if (n < 2) return values.slice();
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  values.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return values.map((_, x) => Math.round((slope * x + intercept) * 10) / 10);
}

const GLASS = {
  borderRadius: '12px',
  border: '1px solid hsl(35,20%,78%)',
  bgcolor: 'hsl(40,35%,96%)',
};

const fadeUp = (delay = 0) => ({
  '@keyframes fadeUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to:   { opacity: 1, transform: 'translateY(0)' },
  },
  animation: `fadeUp 0.5s ease ${delay}s both`,
});

export default function HistoryPage() {
  const { token } = useAuth();
  const api = makeApiClient(token);
  const { historyBusiness: business, setHistoryBusiness: setBusiness } = useBusiness();
  const location = useLocation();
  const navigate = useNavigate();

  // Each company: { key, label, color, data: [{date, score}], stock: [{date, close}] | null }
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [error, setError] = useState('');
  // Guards against React StrictMode replaying the auto-load effect twice in dev.
  const autoLoadStartedRef = useRef(false);
  const [showBestFit, setShowBestFit] = useState(false);
  const [showSentiment, setShowSentiment] = useState(true);
  const [showStock, setShowStock] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [shareCopied, setShareCopied] = useState(false);

  // Saved comparisons — listing/deleting lives on /comparisons; here we only save
  // (from the toolbar) and auto-load when arriving via ?load=<id>.
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  // Canonical day-key: YYYY-MM-DD (sortable lexicographically and unambiguous to parse).
  const toIso = (d) => {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  };
  // Display label for the X axis tick (DD MMM YY).
  const toDateLabel = (iso) =>
    new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit' });

  // Load history + sentiment + stock for a single business and shape it into a
  // chart-ready object. Returns null on failure so callers can filter it out.
  const loadCompanyData = async (biz, color) => {
    // Only pass the three keys the analytical endpoints accept — saved comparisons
    // can come back with extra metadata (business_key etc.) that would otherwise
    // be forwarded as query params and miss the database match.
    const params = new URLSearchParams({
      business_name: biz.business_name ?? '',
      location:      biz.location      ?? '',
      category:      biz.category      ?? '',
    });
    const stockParams = new URLSearchParams({ business_name: biz.business_name ?? '' });

    const [historyRes, sentimentRes, stockRes] = await Promise.all([
      api(`/analytical-model/history?${params}`),
      api(`/analytical-model/sentiment?${params}`),
      api(`/data-collection/stock?${stockParams}`).catch(() => null),
    ]);

    if (!historyRes.ok) return null;
    const result = await historyRes.json();

    const sentimentByIso = new Map();
    result.results.forEach((r) => {
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
      key: result.business_key,
      // Sanitized chart-safe key. Recharts treats dots in dataKey as nested-property
      // accessors (so `row['a.b']` is read as `row.a.b`) and dies silently when the
      // key contains them. We also append a random suffix so two companies that
      // happen to hash to the same business_key still get unique chart columns.
      chartKey: `co_${String(result.business_key ?? '').replace(/[^a-zA-Z0-9_]/g, '_')}_${Math.random().toString(36).slice(2, 8)}`,
      label: biz.business_name,
      location: biz.location,
      category: biz.category,
      color,
      data,
      stock,
      snapshot,
      results: result.results,
    };
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (companies.length >= SERIES_COLORS.length) return;
    setLoading(true);
    setError('');
    try {
      const color = SERIES_COLORS[companies.length];
      const loaded = await loadCompanyData(business, color);
      if (!loaded) throw new Error('Could not load history for this company.');
      setCompanies((prev) => [...prev, loaded]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeCompany = (key) => setCompanies((prev) => prev.filter((c) => c.key !== key));

  // ── Saved comparisons ──────────────────────────────────────────────────────────
  // Auto-load when the user arrived from /comparisons via navigation state.
  useEffect(() => {
    const incoming = location.state?.comparisonBusinesses;
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    if (autoLoadStartedRef.current) return; // StrictMode dev replay guard
    autoLoadStartedRef.current = true;

    // Clear the state right away so refreshes or back-nav don't replay it.
    navigate(location.pathname, { replace: true, state: {} });

    setLoading(true);
    setLoadingSaved(true);
    setError('');
    setCompanies([]);
    (async () => {
      // Load companies one at a time, with a short pause between each — loading
      // them in parallel triggers the backend's rate limiter on bigger sets.
      const PAUSE_MS = 750;
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const slots = incoming.slice(0, SERIES_COLORS.length);
      const missed = [];

      for (let i = 0; i < slots.length; i++) {
        setLoadingStage(`Loading ${i + 1} of ${slots.length}: ${slots[i].business_name}…`);
        let company = null;
        try {
          company = await loadCompanyData(slots[i], SERIES_COLORS[i]);
        } catch {
          company = null;
        }
        if (company) {
          // Append to the chart as we go so the user sees progress.
          setCompanies((prev) => [...prev, company]);
        } else {
          missed.push(slots[i]);
        }
        if (i < slots.length - 1) await sleep(PAUSE_MS);
      }

      setLoadingStage('');
      setLoading(false);
      setLoadingSaved(false);

      const loadedCount = slots.length - missed.length;
      if (loadedCount === 0) {
        setError(
          `Couldn't load any of the saved companies: ${missed.map((b) => b.business_name).join(', ')}. They may not be in the database yet — try running a Standard Analysis on each first.`,
        );
      } else if (missed.length > 0) {
        setError(
          `Loaded ${loadedCount} of ${slots.length} companies. No data for: ${missed.map((b) => `${b.business_name} (${b.location || '—'})`).join(', ')}.`,
        );
      }
    })();
  }, [location.state]);

  const handleSaveComparison = async () => {
    if (companies.length < 2 || !saveName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await api('/users/me/comparisons', {
        method: 'POST',
        body: JSON.stringify({
          name: saveName.trim(),
          businesses: companies.map((c) => ({
            business_name: c.label,
            location: c.location ?? '',
            category: c.category ?? '',
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not save comparison.');
      }
      await res.json();
      setSaveDialogOpen(false);
      setSaveName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadCsv = () => {
    if (companies.length === 0) return;
    const sections = [
      {
        title: 'Premium Analysis Report',
        headers: ['Generated', 'Companies Selected'],
        rows: [[new Date().toISOString(), companies.length]],
      },
      {
        title: 'Selected Leaderboard',
        headers: ['Rank', 'Business', 'Score', 'Rating', 'Items Analysed', 'Stock Symbol'],
        rows: leaderboard.map((c, i) => {
          // Stock array presence is a proxy for "publicly listed".
          const hasStock = companies.find((x) => x.key === c.key)?.stock?.length > 0;
          return [i + 1, c.label, c.score ?? '', c.rating ?? '', c.items ?? '', hasStock ? 'yes' : 'no'];
        }),
      },
    ];

    // Keywords per company
    const kwRows = [];
    companies.forEach((c) => {
      const ks = c.snapshot?.keyword_split;
      if (ks?.positive?.length || ks?.negative?.length) {
        (ks.positive ?? []).forEach((kw) => kwRows.push([c.label, 'positive', kw]));
        (ks.negative ?? []).forEach((kw) => kwRows.push([c.label, 'negative', kw]));
      } else {
        (c.snapshot?.keywords ?? []).forEach((kw) => kwRows.push([c.label, '', kw]));
      }
    });
    if (kwRows.length) {
      sections.push({ title: 'Keywords', headers: ['Business', 'Polarity', 'Keyword'], rows: kwRows });
    }

    // Source comparison — long format (one row per company × source)
    if (sourceChartData.length) {
      const longRows = [];
      sourceChartData.forEach((row) => {
        companies.forEach((c) => {
          if (row[c.chartKey] != null) longRows.push([row.source, c.label, row[c.chartKey]]);
        });
      });
      sections.push({
        title: 'Source Comparison (avg score per source)',
        headers: ['Source', 'Business', 'Avg Score'],
        rows: longRows,
      });
    }

    // Sentiment history — long format
    const sentRows = [];
    companies.forEach((c) => {
      c.data.forEach((pt) => sentRows.push([pt.iso, c.label, pt.score]));
    });
    sentRows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    if (sentRows.length) {
      sections.push({ title: 'Sentiment History', headers: ['Date', 'Business', 'Score'], rows: sentRows });
    }

    // Stock price history — long format
    const stkRows = [];
    companies.forEach((c) => {
      c.stock?.forEach((pt) => stkRows.push([pt.iso, c.label, pt.close]));
    });
    stkRows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    if (stkRows.length) {
      sections.push({ title: 'Stock Price History', headers: ['Date', 'Business', 'Close'], rows: stkRows });
    }

    // Per-company analysis timeline (one row per run)
    const tlRows = [];
    companies.forEach((c) => {
      (c.results ?? []).forEach((r) => {
        tlRows.push([r.date_time, c.label, r.overall_score, r.overall_rating, r.overall_sentiment]);
      });
    });
    tlRows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    if (tlRows.length) {
      sections.push({
        title: 'Analysis Timeline (every run)',
        headers: ['Timestamp', 'Business', 'Score', 'Rating', 'Sentiment'],
        rows: tlRows,
      });
    }

    const slug = companies.map((c) => safeFilename(c.label)).join('_vs_');
    downloadCsv(`${slug || 'premium'}-analysis.csv`, buildCsv(sections));
  };

  // Build a public /compare URL with one `c=<name>|<location>|<category>` per company,
  // and embed a compressed snapshot of the loaded data in the hash so the receiver's
  // page renders instantly. If the snapshot is stripped (e.g. by Slack truncation),
  // the c= params still let the page fetch fresh data on its own.
  const handleShareComparison = async () => {
    if (companies.length === 0) return;
    const params = new URLSearchParams();
    companies.forEach((c) => {
      params.append('c', `${c.label}|${c.location ?? ''}|${c.category ?? ''}`);
    });
    const hash = buildSnapshotHash({
      companies: companies.map((c) => ({
        key: c.key,
        label: c.label,
        location: c.location,
        category: c.category,
        color: c.color,
        data: c.data,
        stock: c.stock,
        snapshot: c.snapshot,
        results: c.results,
      })),
    });
    const url = `${window.location.origin}/compare?${params.toString()}${hash}`;
    try { await navigator.clipboard.writeText(url); } catch { /* clipboard blocked — non-fatal */ }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  // Merge every company's sentiment + stock onto one chronologically-sorted axis (keyed by ISO).
  // O(d) lookups via per-company Maps instead of nested .find() calls.
  const { chartData } = useMemo(() => {
    if (companies.length === 0) return { chartData: [] };

    const indexed = companies.map((c) => ({
      chartKey: c.chartKey,
      sentimentMap: new Map(c.data.map((d) => [d.iso, d.score])),
      stockMap: new Map((c.stock ?? []).map((d) => [d.iso, d.close])),
    }));

    const allIsos = new Set();
    indexed.forEach((c) => {
      c.sentimentMap.forEach((_, iso) => allIsos.add(iso));
      c.stockMap.forEach((_, iso) => allIsos.add(iso));
    });

    const sorted = Array.from(allIsos).sort(); // ISO strings sort chronologically

    const chartData = sorted.map((iso) => {
      const row = { iso, date: toDateLabel(iso) };
      indexed.forEach((c) => {
        row[c.chartKey] = c.sentimentMap.has(iso) ? c.sentimentMap.get(iso) : null;
        row[`${c.chartKey}_stock`] = c.stockMap.has(iso) ? c.stockMap.get(iso) : null;
      });
      return row;
    });

    return { chartData };
  }, [companies]);

  const anyStock = companies.some((c) => c.stock?.length > 0);

  // Mini leaderboard — ranked by latest sentiment score, including top keywords.
  const leaderboard = useMemo(() => {
    return companies
      .map((c) => ({
        key: c.key,
        label: c.label,
        color: c.color,
        score: c.snapshot?.overall_score ?? null,
        rating: c.snapshot?.overall_rating ?? null,
        keywords: c.snapshot?.keyword_split ?? null,
        flatKeywords: c.snapshot?.keywords ?? [],
        items: c.snapshot?.items_analysed ?? 0,
      }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [companies]);

  // Per-source comparison data — X-axis = source, one bar per company.
  // Each row averages a company's breakdown items grouped by source.
  const sourceChartData = useMemo(() => {
    const sourcesPresent = new Set();
    const perCompany = new Map();

    companies.forEach((c) => {
      const grouped = new Map(); // src -> { total, n }
      (c.snapshot?.breakdown ?? []).forEach((item) => {
        sourcesPresent.add(item.source);
        const slot = grouped.get(item.source) ?? { total: 0, n: 0 };
        slot.total += item.score;
        slot.n += 1;
        grouped.set(item.source, slot);
      });
      const avgBySource = {};
      grouped.forEach((v, k) => { avgBySource[k] = Math.round(v.total / v.n); });
      perCompany.set(c.chartKey, avgBySource);
    });

    const orderedSources = ['google_maps_reviews', 'newsapi', 'google_news_rss', 'reddit']
      .filter((s) => sourcesPresent.has(s));

    return orderedSources.map((src) => {
      const row = { source: sourceLabel(src) };
      companies.forEach((c) => {
        const avg = perCompany.get(c.chartKey)?.[src];
        if (avg != null) row[c.chartKey] = avg;
      });
      return row;
    });
  }, [companies]);

  // Apply date range filter
  const filteredChartData = useMemo(() => {
    if (dateRange === 'all' || chartData.length === 0) return chartData;
    const days = dateRange === '7d' ? 7 : 30;
    return chartData.slice(-days);
  }, [chartData, dateRange]);

  // Best-fit lines: one per company (over filtered data)
  const bestFitData = useMemo(() => {
    if (!showBestFit || companies.length === 0) return [];
    return companies.map((c) => {
      const scores = filteredChartData.map((row) => row[c.chartKey] ?? null);
      const defined = scores.filter((v) => v !== null);
      if (defined.length < 2) return null;
      const avg = defined.reduce((a, b) => a + b, 0) / defined.length;
      const filled = scores.map((v) => (v !== null ? v : avg));
      const fit = linearRegression(filled);
      return { key: `${c.chartKey}_fit`, color: c.color, fit };
    }).filter(Boolean);
  }, [showBestFit, companies, filteredChartData]);

  // Merge best-fit values into chart rows
  const mergedData = useMemo(() => {
    if (!showBestFit || bestFitData.length === 0) return filteredChartData;
    return filteredChartData.map((row, i) => {
      const extra = {};
      bestFitData.forEach((bf) => { extra[bf.key] = bf.fit[i]; });
      return { ...row, ...extra };
    });
  }, [filteredChartData, bestFitData, showBestFit]);

  // Stats across all loaded companies
  const allScores = companies.flatMap((c) => c.data.map((d) => d.score));
  const avgScore = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length * 10) / 10
    : null;
  const peakScore = allScores.length ? Math.max(...allScores) : null;

  const canAddMore = companies.length < SERIES_COLORS.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ ...fadeUp(0), display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
            Premium Analysis
          </Typography>
          <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)', mt: 0.5 }}>
            Compare sentiment trends across multiple companies over time.
          </Typography>
        </Box>
        {companies.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SaveIcon />}
              disabled={companies.length < 2}
              onClick={() => { setSaveName(companies.map((c) => c.label).join(' vs ')); setSaveDialogOpen(true); }}
            >
              Save comparison
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={shareCopied ? <CheckIcon /> : <ShareIcon />}
              onClick={handleShareComparison}
              sx={{
                color: shareCopied ? 'hsl(95,25%,32%)' : undefined,
                borderColor: shareCopied ? 'hsl(95,25%,42%)' : undefined,
              }}
            >
              {shareCopied ? 'Link copied' : 'Share comparison'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadCsv}
            >
              Download CSV
            </Button>
          </Box>
        )}
      </Box>

      {/* Save dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => !saving && setSaveDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '14px', bgcolor: 'hsl(40,35%,96%)', minWidth: 400 } }}
      >
        <DialogTitle sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
          Save this comparison
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)', mb: 2 }}>
            Give this comparison a name so you can load it again later.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            disabled={saving}
            onKeyDown={(e) => { if (e.key === 'Enter' && saveName.trim()) handleSaveComparison(); }}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2 }}>
            {companies.map((c) => (
              <Chip
                key={c.key}
                label={c.label}
                size="small"
                sx={{
                  bgcolor: `${c.color}22`,
                  border: `1px solid ${c.color}55`,
                  color: c.color,
                  fontWeight: 600,
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveComparison}
            disabled={saving || !saveName.trim() || companies.length < 2}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add company to graph — hidden while a saved comparison is being auto-loaded
          so the page focuses on the in-progress chart. */}
      {!loadingSaved && (
      <Box sx={{
        ...fadeUp(0.07),
        borderRadius: '14px',
        border: '1px dashed hsl(35,20%,60%)',
        bgcolor: 'hsl(40,40%,93%)',
        p: 2.5,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <CompareArrowsIcon sx={{ color: 'hsl(15,45%,42%)', fontSize: 22 }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
            Add a company to the comparison graph
          </Typography>
          <Chip
            label={`${companies.length} / ${SERIES_COLORS.length}`}
            size="small"
            sx={{
              ml: 'auto',
              bgcolor: 'rgba(0,0,0,0.05)',
              color: 'hsl(0,0%,25%)',
              fontWeight: 600,
            }}
          />
        </Box>
        <Typography variant="body2" sx={{ color: 'hsl(0,0%,40%)', mb: 2 }}>
          Each company you add gets its own coloured line on the chart below. Up to {SERIES_COLORS.length} at once.
        </Typography>

        <Box component="form" onSubmit={handleAdd} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <BusinessPicker business={business} setBusiness={setBusiness} />
          <Box>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !canAddMore || !business.business_name}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
              sx={{ minWidth: 180 }}
            >
              {loading ? 'Loading…' : canAddMore ? 'Add to graph' : 'Max reached'}
            </Button>
          </Box>
        </Box>

        {/* Active company chips */}
        {companies.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 2, pt: 2, borderTop: '1px solid hsl(35,20%,78%)' }}>
            <Typography variant="caption" sx={{ color: 'hsl(0,0%,35%)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, mr: 0.5 }}>
              On the graph:
            </Typography>
            {companies.map((c) => (
              <Chip
                key={c.key}
                label={c.stock?.length ? `${c.label} · 📈` : c.label}
                size="small"
                onDelete={() => removeCompany(c.key)}
                sx={{
                  bgcolor: `${c.color}22`,
                  border: `1px solid ${c.color}55`,
                  color: c.color,
                  fontWeight: 600,
                  '& .MuiChip-deleteIcon': { color: c.color },
                }}
              />
            ))}
          </Box>
        )}
      </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {loading && loadingStage && (
        <Alert
          icon={<CircularProgress size={18} sx={{ color: 'hsl(15,45%,42%)' }} />}
          severity="info"
          sx={{
            bgcolor: 'rgba(160,90,60,0.10)',
            color: 'hsl(0,0%,20%)',
            border: '1px solid rgba(160,90,60,0.30)',
            '& .MuiAlert-icon': { color: 'hsl(15,45%,42%)', alignItems: 'center' },
          }}
        >
          {loadingStage}
        </Alert>
      )}

      {companies.length > 0 && (
        <>
          {/* Stats */}
          <Grid container spacing={2} sx={fadeUp(0.1)}>
            <Grid size={{ xs: 12, md: 4 }}>
              <StatsCard label="Avg Score" value={avgScore ?? '—'} icon={TimelineIcon} glow="green" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <StatsCard label="Companies" value={companies.length} icon={CalendarMonthIcon} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <StatsCard label="Peak Score" value={peakScore ?? '—'} icon={StarIcon} glow="purple" />
            </Grid>
          </Grid>

          {/* Mini leaderboard + per-source comparison */}
          <Grid container spacing={2} sx={fadeUp(0.13)}>
            {/* Leaderboard */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ ...GLASS, overflow: 'hidden', height: '100%' }}>
                <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid hsl(35,20%,78%)', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmojiEventsIcon sx={{ fontSize: 19, color: 'hsl(38,55%,32%)' }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                      Selected Leaderboard
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }}>
                      Latest sentiment scores + top keywords for the companies you've added
                    </Typography>
                  </Box>
                </Box>
                {leaderboard.map((c, i) => (
                  <Box key={c.key} sx={{
                    px: 2.5, py: 2,
                    borderBottom: i < leaderboard.length - 1 ? '1px solid hsl(35,20%,78%)' : 'none',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: c.keywords || c.flatKeywords.length ? 1 : 0 }}>
                      <Box sx={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 14,
                        bgcolor: `${c.color}22`, color: c.color, border: `1px solid ${c.color}55`,
                      }}>
                        {i + 1}
                      </Box>
                      <Typography variant="body1" fontWeight={600} sx={{ color: 'hsl(0,0%,12%)', flex: 1, minWidth: 0 }} noWrap>
                        {c.label}
                      </Typography>
                      {c.score != null
                        ? <SentimentBadge score={c.score} size="sm" />
                        : <Typography variant="caption" sx={{ color: 'hsl(0,0%,45%)' }}>No data</Typography>}
                    </Box>

                    {/* Keywords — split by polarity when available */}
                    {c.keywords && (c.keywords.positive?.length > 0 || c.keywords.negative?.length > 0) ? (
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
            </Grid>

            {/* Source breakdown comparison */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ ...GLASS, overflow: 'hidden', height: '100%' }}>
                <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid hsl(35,20%,78%)', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BarChartIcon sx={{ fontSize: 19, color: 'hsl(210,50%,40%)' }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                      Source Comparison
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }}>
                      Average score per source — one bar per company, grouped by source
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ p: 2 }}>
                  {sourceChartData.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'hsl(0,0%,45%)', textAlign: 'center', py: 4 }}>
                      No source breakdown available yet.
                    </Typography>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={Math.max(220, 60 * sourceChartData.length + 60)}>
                        <BarChart data={sourceChartData} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(35,20%,78%)" vertical={false} />
                          <XAxis dataKey="source" stroke="hsl(0,0%,35%)" tick={{ fill: 'hsl(0,0%,35%)', fontSize: 14 }} />
                          <YAxis
                            domain={[0, 100]}
                            stroke="hsl(0,0%,35%)"
                            tick={{ fill: 'hsl(0,0%,35%)', fontSize: 13 }}
                            width={36}
                          />
                          <ReTooltip
                            contentStyle={{
                              backgroundColor: 'hsl(40,35%,96%)',
                              border: '1px solid hsl(35,20%,78%)',
                              borderRadius: 8,
                              color: 'hsl(0,0%,12%)',
                            }}
                            formatter={(value, key) => {
                              const co = companies.find((c) => c.chartKey === key);
                              return [`${value}/100`, co ? co.label : key];
                            }}
                          />
                          {companies.map((c) => (
                            <Bar
                              key={c.key}
                              dataKey={c.chartKey}
                              fill={c.color}
                              radius={[4, 4, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                      {/* Legend mapping colour → company */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, mt: 1 }}>
                        {companies.map((c) => (
                          <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: 2, bgcolor: c.color }} />
                            <Typography variant="caption" sx={{ color: 'hsl(0,0%,30%)' }}>
                              {c.label}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </>
                  )}
                </Box>
              </Box>
            </Grid>
          </Grid>

          {/* Chart */}
          {chartData.length > 1 && (
            <Box sx={{ ...GLASS, p: 3, ...fadeUp(0.17) }}>
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
                    control={
                      <Switch
                        checked={showSentiment}
                        onChange={(e) => setShowSentiment(e.target.checked)}
                        size="small"
                      />
                    }
                    label={<Typography variant="caption" sx={{ color: 'hsl(0,0%,35%)' }}>Sentiment</Typography>}
                    sx={{ m: 0 }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showStock}
                        onChange={(e) => setShowStock(e.target.checked)}
                        size="small"
                        disabled={!anyStock}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: anyStock ? 'hsl(0,0%,35%)' : 'hsl(0,0%,55%)' }}>
                        Stock price{!anyStock ? ' (n/a)' : ''}
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showBestFit}
                        onChange={(e) => setShowBestFit(e.target.checked)}
                        size="small"
                      />
                    }
                    label={<Typography variant="caption" sx={{ color: 'hsl(0,0%,35%)' }}>Best-fit</Typography>}
                    sx={{ m: 0 }}
                  />
                </Box>
              </Box>
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={mergedData}>
                  <defs>
                    {companies.map((c) => (
                      <linearGradient key={c.key} id={`grad_${c.chartKey}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={c.color} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(35,20%,78%)" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(0,0%,35%)"
                    tick={{ fill: 'hsl(0,0%,35%)', fontSize: 14 }}
                    minTickGap={40}
                  />
                  {/* Left axis: sentiment (0–100). Render even when hidden so layout stays stable. */}
                  <YAxis
                    yAxisId="sentiment"
                    domain={[0, 100]}
                    stroke="hsl(0,0%,35%)"
                    tick={{ fill: 'hsl(0,0%,35%)', fontSize: 14 }}
                    label={{ value: 'Sentiment', angle: -90, position: 'insideLeft', fill: 'hsl(0,0%,40%)', fontSize: 13 }}
                    hide={!showSentiment}
                  />
                  {/* Right axis: stock price ($). Only shown if at least one company is publicly listed AND the toggle is on. */}
                  {showStock && anyStock && (
                    <YAxis
                      yAxisId="stock"
                      orientation="right"
                      domain={['dataMin', 'dataMax']}
                      stroke="hsl(0,0%,35%)"
                      tick={{ fill: 'hsl(0,0%,35%)', fontSize: 14 }}
                      tickFormatter={(v) => `$${Math.round(v)}`}
                      label={{ value: 'Stock $', angle: 90, position: 'insideRight', fill: 'hsl(0,0%,40%)', fontSize: 13 }}
                    />
                  )}
                  <ReTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(40,35%,96%)',
                      border: '1px solid hsl(35,20%,78%)',
                      borderRadius: '8px',
                      color: 'hsl(0,0%,12%)',
                    }}
                    labelStyle={{ color: 'hsl(0,0%,12%)', fontWeight: 600, marginBottom: 4 }}
                    formatter={(value, key) => {
                      if (typeof key !== 'string') return [value, key];
                      if (key.endsWith('_fit')) return null;
                      if (key.endsWith('_stock')) {
                        const co = companies.find((c) => `${c.chartKey}_stock` === key);
                        return [`$${Number(value).toFixed(2)}`, co ? `${co.label} (stock)` : 'Stock'];
                      }
                      const co = companies.find((c) => c.chartKey === key);
                      return [`${value}/100`, co ? `${co.label} (sentiment)` : 'Sentiment'];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ color: 'hsl(0,0%,35%)', fontSize: 15, paddingTop: 12 }}
                    formatter={(value) => {
                      if (value.endsWith('_fit')) return null;
                      if (value.endsWith('_stock')) {
                        const co = companies.find((c) => `${c.chartKey}_stock` === value);
                        return co ? `${co.label} (stock)` : value;
                      }
                      const co = companies.find((c) => c.chartKey === value);
                      return co ? co.label : value;
                    }}
                  />
                  {/* Sentiment area per company */}
                  {showSentiment && companies.map((c) => (
                    <Area
                      key={c.key}
                      yAxisId="sentiment"
                      type="monotone"
                      dataKey={c.chartKey}
                      name={c.chartKey}
                      stroke={c.color}
                      fill={`url(#grad_${c.chartKey})`}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: c.color }}
                      connectNulls
                    />
                  ))}
                  {/* Stock line per company — dashed to differentiate from sentiment area */}
                  {showStock && anyStock && companies.map((c) => (
                    c.stock?.length ? (
                      <Line
                        key={`${c.key}_stock`}
                        yAxisId="stock"
                        type="monotone"
                        dataKey={`${c.chartKey}_stock`}
                        name={`${c.chartKey}_stock`}
                        stroke={c.color}
                        strokeWidth={1.75}
                        strokeDasharray="4 4"
                        dot={false}
                        activeDot={{ r: 3, fill: c.color }}
                        connectNulls
                      />
                    ) : null
                  ))}
                  {/* Best-fit lines over sentiment (dashed) */}
                  {showSentiment && showBestFit && bestFitData.map((bf) => (
                    <Line
                      key={bf.key}
                      yAxisId="sentiment"
                      type="linear"
                      dataKey={bf.key}
                      name={bf.key}
                      stroke={bf.color}
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      dot={false}
                      activeDot={false}
                      legendType="none"
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          )}

          {/* Per-company timeline tables */}
          {companies.map((c) => (
            <Box key={c.key} sx={{ ...GLASS, overflow: 'hidden' }}>
              <Box sx={{
                px: 2.5, py: 1.5,
                borderBottom: '1px solid hsl(35,20%,78%)',
                bgcolor: 'rgba(0,0,0,0.035)',
                display: 'flex', alignItems: 'center', gap: 1.5,
              }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color, flexShrink: 0 }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                  {c.label} — Analysis Timeline
                </Typography>
                <Tooltip title="Remove company">
                  <IconButton size="small" onClick={() => removeCompany(c.key)} sx={{ ml: 'auto', color: 'hsl(0,0%,35%)' }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {c.results.map((r, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    px: 2.5, py: 2,
                    borderBottom: '1px solid hsl(35,20%,78%)',
                    '&:last-child': { borderBottom: 0 },
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.035)' },
                    transition: 'background 0.15s',
                  }}
                >
                  <Box sx={{ minWidth: 140, flexShrink: 0 }}>
                    <Typography variant="body2" fontWeight={500} sx={{ color: 'hsl(210,40%,85%)', display: 'block' }}>
                      {new Date(r.date_time).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'hsl(0,0%,40%)' }}>
                      {new Date(r.date_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                  <SentimentBadge score={r.overall_score} size="md" />
                  <Typography variant="body1" sx={{ flex: 1, color: 'hsl(0,0%,22%)' }}>
                    {'⭐'.repeat(r.overall_rating)} · {r.overall_sentiment}
                  </Typography>
                </Box>
              ))}
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}
