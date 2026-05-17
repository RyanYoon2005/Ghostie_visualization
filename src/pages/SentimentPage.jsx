import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TagIcon from '@mui/icons-material/Tag';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CategoryIcon from '@mui/icons-material/Category';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ShareIcon from '@mui/icons-material/Share';
import CheckIcon from '@mui/icons-material/Check';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Collapse from '@mui/material/Collapse';
import Link from '@mui/material/Link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Cell,
  LineChart, Line,
} from 'recharts';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import InfoIcon from '@mui/icons-material/Info';
import { SentimentBadge } from '../components/SentimentBadge';
import { StatsCard } from '../components/StatsCard';
import { ScoreGauge } from '../components/ScoreGauge';
import { makeApiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useFavourites } from '../hooks/useFavourites';
import { BusinessPicker } from '../components/BusinessPicker';
import { useBusiness } from '../context/BusinessContext';
import { useToast } from '../context/ToastContext';
import { buildCsv, downloadCsv, safeFilename } from '../utils/csv';
import { buildSnapshotHash } from '../utils/snapshot';

const sourceLabel = (s) => {
  if (s === 'google_maps_reviews') return 'Review';
  if (s === 'newsapi') return 'News';
  if (s === 'reddit') return 'Reddit';
  if (s === 'google_news_rss') return 'Google News';
  return s || '—';
};

const sourceColor = (s) => {
  if (s === 'google_maps_reviews') return 'hsl(210,25%,48%)';
  if (s === 'newsapi') return 'hsl(35,50%,50%)';
  if (s === 'reddit') return 'hsl(18,40%,48%)';
  if (s === 'google_news_rss') return 'hsl(70,25%,42%)';
  return 'hsl(0,0%,35%)';
};

const scoreColor = (s) => {
  if (s >= 57.5) return 'hsl(95,25%,42%)';
  if (s >= 42.5) return 'hsl(38,55%,48%)';
  return 'hsl(10,50%,45%)';
};

async function computeKey(name, location, category) {
  const raw = `${name}${location}${category}`.toLowerCase().replace(/ /g, '');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const fadeUp = (delay = 0) => ({
  '@keyframes fadeUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to:   { opacity: 1, transform: 'translateY(0)' },
  },
  animation: `fadeUp 0.5s ease ${delay}s both`,
});

export default function SentimentPage() {
  const { token } = useAuth();
  const api = makeApiClient(token);
  const { favourites, toggle } = useFavourites(api);
  const { sentimentBusiness: business, setSentimentBusiness: setBusiness, refreshCompanies } = useBusiness();
  const { showToast } = useToast();
  const [result, setResult] = useState(null);
  const [competitor, setCompetitor] = useState(null);
  const [stock, setStock] = useState(null);
  const [businessKey, setBusinessKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(''); // 'analysing' | 'collecting' | 'reanalysing'
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedItems, setExpandedItems] = useState(() => new Set());

  const toggleExpanded = (idx) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleShare = () => {
    if (!result) return;
    // Embed the loaded data as a compressed snapshot in the URL hash so the
    // receiver's scorecard renders instantly instead of re-running the analysis.
    const hash = buildSnapshotHash({
      sentiment: result,
      competitor,
      stock,
    });
    const url = `${window.location.origin}/score/${encodeURIComponent(result.business_name)}?location=${encodeURIComponent(result.location)}&category=${encodeURIComponent(result.category)}${hash}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    if (!result) return;
    const sections = [
      {
        title: 'Standard Analysis Report',
        headers: ['Business', 'Location', 'Category', 'Generated'],
        rows: [[result.business_name, result.location, result.category, new Date().toISOString()]],
      },
      {
        title: 'Headline Metrics',
        headers: ['Overall Score', 'Overall Rating', 'Overall Sentiment', 'Items Analysed'],
        rows: [[result.overall_score, result.overall_rating, result.overall_sentiment, result.items_analysed]],
      },
    ];

    if (result.summary) sections.push({ title: 'Summary', rows: [result.summary] });
    if (result.explanation) sections.push({ title: 'What Drove This Score', rows: [result.explanation] });

    if (result.keyword_split?.positive?.length || result.keyword_split?.negative?.length) {
      sections.push({
        title: 'Keywords',
        headers: ['Polarity', 'Keyword'],
        rows: [
          ...(result.keyword_split.positive ?? []).map((k) => ['positive', k]),
          ...(result.keyword_split.negative ?? []).map((k) => ['negative', k]),
        ],
      });
    } else if (result.keywords?.length) {
      sections.push({
        title: 'Keywords',
        headers: ['Keyword'],
        rows: result.keywords.map((k) => [k]),
      });
    }

    if (competitor) {
      sections.push({
        title: 'Competitor Gap — Summary',
        headers: ['Field', 'Value'],
        rows: [
          ['Your Score', competitor.your_score],
          ['Category', competitor.category],
          ['Category Group', competitor.category_group ?? ''],
          ['Category Average', competitor.category_average],
          ['Gap to Leader', competitor.gap_to_leader],
          ['Rank', `${competitor.rank} / ${competitor.total_in_category}`],
          ['Leader', `${competitor.leader?.business_name ?? ''} (${competitor.leader?.score ?? ''})`],
        ],
      });
      if (competitor.competitors?.length) {
        sections.push({
          title: 'Competitor Gap — Competitors',
          headers: ['Rank', 'Business', 'Location', 'Score', 'Sentiment'],
          rows: competitor.competitors.map((c, i) => [i + 1, c.business_name, c.location, c.score, c.sentiment]),
        });
      }
    }

    if (stock) {
      if (stock.quote) {
        sections.push({
          title: `Stock Quote — ${stock.symbol}`,
          headers: ['Symbol', 'Current', 'Open', 'High', 'Low', 'Prev Close', 'Change %'],
          rows: [[stock.symbol, stock.quote.current_price, stock.quote.open, stock.quote.high, stock.quote.low, stock.quote.prev_close, stock.quote.change_percent]],
        });
      }
      if (stock.price_history?.length) {
        sections.push({
          title: `Stock Price History — ${stock.symbol} (${stock.history_days} days)`,
          headers: ['Date', 'Open', 'High', 'Low', 'Close', 'Volume'],
          rows: stock.price_history.map((p) => [p.date, p.open, p.high, p.low, p.close, p.volume]),
        });
      }
    }

    if (result.breakdown?.length) {
      sections.push({
        title: 'Source Breakdown',
        headers: ['Source', 'Sentiment', 'Score', 'Rating', 'Title', 'Body', 'URL'],
        rows: result.breakdown.map((b) => [b.source, b.sentiment, b.score, b.rating ?? '', b.title ?? '', b.body ?? '', b.url ?? '']),
      });
    }

    const fname = `${safeFilename(result.business_name)}-standard-analysis.csv`;
    downloadCsv(fname, buildCsv(sections));
    showToast('CSV downloaded', 'success');
  };

  // Run /analytical-model/sentiment. Returns {ok, json, status}.
  const fetchSentiment = async (params) => {
    const res = await api(`/analytical-model/sentiment?${params}`);
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  };

  // Trigger /collect for the current business and wait for completion.
  const collect = async () => {
    const res = await api('/data-collection/collect', {
      method: 'POST',
      body: JSON.stringify(business),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not collect data for this business.');
    }
    return res.json();
  };

  // A sentiment "miss" — either an explicit not-found or a 0-item result.
  const isNoData = ({ ok, status, json }) =>
    status === 404 ||
    (ok && (json.items_analysed === 0 || json.overall_score == null));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoadingStage('analysing');
    setError('');
    setResult(null);
    setCompetitor(null);
    setStock(null);
    setBusinessKey(null);
    setExpandedItems(new Set());
    try {
      const params = new URLSearchParams(business);
      let sentiment = await fetchSentiment(params);

      // If no record yet, run collection then retry the analysis.
      if (isNoData(sentiment)) {
        setLoadingStage('collecting');
        const collectResult = await collect();
        if ((collectResult.total_results ?? 0) === 0) {
          throw new Error(`No public data found for "${business.business_name}" in ${business.location}. Try a more specific name or different location.`);
        }
        refreshCompanies();
        setLoadingStage('reanalysing');
        sentiment = await fetchSentiment(params);
      }

      if (!sentiment.ok) {
        throw new Error(sentiment.json.detail || 'Request failed');
      }
      if (isNoData(sentiment)) {
        throw new Error('Collection ran but the analysis produced no signals. Try again in a moment.');
      }

      setResult(sentiment.json);
      const key = await computeKey(business.business_name, business.location, business.category);
      setBusinessKey(key);

      // Side-by-side enrichments — failures here don't block the main result
      api(`/analytical-model/competitor-gap?${params}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data && !data.detail) setCompetitor(data); })
        .catch(() => {});

      const stockParams = new URLSearchParams({ business_name: business.business_name });
      api(`/data-collection/stock?${stockParams}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data && !data.detail) setStock(data); })
        .catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const displayScore = result ? result.overall_score : null;
  const isFav = favourites.has(businessKey);

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 3, ...fadeUp(0) }}>
        <Typography variant="h4" fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
          Standard Analysis
        </Typography>
        <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)', mt: 0.5 }}>
          Analyse the public sentiment of any business based on reviews, news and social media.
        </Typography>
      </Box>

      {/* Analyse a business — same boutique panel style as Premium Analysis */}
      <Box sx={{
        ...fadeUp(0.05),
        borderRadius: '14px',
        border: '1px dashed hsl(35,20%,60%)',
        bgcolor: 'hsl(40,40%,93%)',
        p: 2.5,
        mb: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <AnalyticsIcon sx={{ color: 'hsl(15,45%,42%)', fontSize: 22 }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
            Analyse a business
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'hsl(0,0%,40%)', mb: 2 }}>
          Enter a business and we'll pull reviews, news and social signals, then score the public sentiment.
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <BusinessPicker business={business} setBusiness={setBusiness} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !business.business_name}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{
                minWidth: 140,
                background: 'linear-gradient(135deg, hsl(15,45%,45%), hsl(15,45%,38%))',
                '&:hover': { background: 'linear-gradient(135deg, hsl(15,45%,48%), hsl(15,45%,42%))' },
              }}
            >
              {loading ? 'Analysing…' : 'Analyse'}
            </Button>
            {loading && (
              <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)' }}>
                {loadingStage === 'collecting'
                  ? 'No record found — collecting fresh data (this can take up to a minute)…'
                  : loadingStage === 'reanalysing'
                  ? 'Data collected — running sentiment analysis…'
                  : 'Analysing sentiment…'}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {result && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Hero: gauge + business info side by side */}
          <Box sx={{
            borderRadius: '16px',
            border: '1px solid hsl(35,20%,78%)',
            bgcolor: 'hsl(40,35%,96%)',
            overflow: 'hidden',
            position: 'relative',
            ...fadeUp(0),
          }}>
            {/* Decorative glow blob */}
            <Box sx={{
              position: 'absolute', top: -60, right: -60,
              width: 300, height: 300, borderRadius: '50%',
              background: `radial-gradient(circle, ${scoreColor(displayScore)}18 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />

            <Box sx={{
              display: 'flex', flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center', gap: 4, p: { xs: 3, md: 4 },
            }}>
              {/* Gauge */}
              <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ScoreGauge score={displayScore} size={200} label="Sentiment Score" />
              </Box>

              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' }, borderColor: 'hsl(35,20%,78%)' }} />

              {/* Business details */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h4" fontWeight={800} sx={{
                      fontFamily: '"Sora", sans-serif',
                      color: 'hsl(0,0%,12%)',
                      lineHeight: 1.25,
                      mb: 0.75,
                    }}>
                      {result.business_name}
                    </Typography>
                    <SentimentBadge score={displayScore} size="md" />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title={isFav ? 'Remove from favourites' : 'Add to favourites'}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={!businessKey}
                          onClick={() => {
                            toggle(businessKey);
                            showToast(isFav ? 'Removed from favourites' : 'Added to favourites', isFav ? 'info' : 'success');
                          }}
                          sx={{
                            color: isFav ? 'hsl(38,55%,48%)' : 'hsl(0,0%,35%)',
                            bgcolor: isFav ? 'rgba(180,140,60,0.10)' : 'rgba(0,0,0,0.05)',
                            '&:hover': { bgcolor: isFav ? 'rgba(180,140,60,0.18)' : 'rgba(0,0,0,0.08)' },
                            transition: 'all 0.2s',
                          }}
                        >
                          {isFav ? <StarIcon /> : <StarBorderIcon />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={copied ? 'Link copied!' : 'Share public scorecard'}>
                      <IconButton
                        size="small"
                        onClick={handleShare}
                        sx={{
                          color: copied ? 'hsl(95,25%,42%)' : 'hsl(0,0%,35%)',
                          bgcolor: copied ? 'rgba(120,135,90,0.12)' : 'rgba(0,0,0,0.05)',
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.08)' },
                          transition: 'all 0.2s',
                        }}
                      >
                        {copied ? <CheckIcon fontSize="small" /> : <ShareIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download full report as CSV">
                      <IconButton
                        size="small"
                        onClick={handleDownloadCsv}
                        sx={{
                          color: 'hsl(0,0%,35%)',
                          bgcolor: 'rgba(0,0,0,0.05)',
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.08)' },
                          transition: 'all 0.2s',
                        }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOnIcon sx={{ fontSize: 19, color: 'hsl(0,0%,40%)' }} />
                    <Typography variant="body1" sx={{ color: 'hsl(0,0%,22%)' }}>{result.location}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CategoryIcon sx={{ fontSize: 19, color: 'hsl(0,0%,40%)' }} />
                    <Typography variant="body1" sx={{ color: 'hsl(0,0%,22%)' }}>{result.category}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TagIcon sx={{ fontSize: 19, color: 'hsl(0,0%,40%)' }} />
                    <Typography variant="body1" sx={{ color: 'hsl(0,0%,22%)' }}>
                      {'⭐'.repeat(result.overall_rating)} ({result.overall_rating}/5)
                    </Typography>
                  </Box>
                </Box>

                {/* Keywords — split by polarity when available, otherwise flat list */}
                {(result.keyword_split?.positive?.length > 0 || result.keyword_split?.negative?.length > 0) ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {result.keyword_split.positive?.length > 0 && (
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                          <TrendingUpIcon sx={{ fontSize: 17, color: 'hsl(95,25%,42%)' }} />
                          <Typography variant="body2" sx={{ color: 'hsl(95,25%,42%)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, fontSize: 14 }}>
                            Positive Signals
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                          {result.keyword_split.positive.map((kw) => (
                            <Chip
                              key={`pos-${kw}`}
                              label={kw}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(120,135,90,0.12)',
                                border: '1px solid hsl(95,25%,32%)',
                                color: 'hsl(95,25%,55%)',
                                fontSize: 14,
                                height: 28,
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                    {result.keyword_split.negative?.length > 0 && (
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                          <TrendingDownIcon sx={{ fontSize: 17, color: 'hsl(10,50%,45%)' }} />
                          <Typography variant="body2" sx={{ color: 'hsl(10,50%,45%)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, fontSize: 14 }}>
                            Negative Signals
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                          {result.keyword_split.negative.map((kw) => (
                            <Chip
                              key={`neg-${kw}`}
                              label={kw}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(180,80,60,0.10)',
                                border: '1px solid hsl(10,50%,30%)',
                                color: 'hsl(10,50%,55%)',
                                fontSize: 14,
                                height: 28,
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                ) : result.keywords?.length > 0 && (
                  <Box>
                    <Typography variant="body2" sx={{ color: 'hsl(0,0%,40%)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, display: 'block', mb: 1, fontSize: 15 }}>
                      Top Keywords
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {result.keywords.map((kw) => (
                        <Chip
                          key={kw}
                          label={kw}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(0,0,0,0.06)',
                            border: '1px solid hsl(35,20%,80%)',
                            color: 'hsl(0,0%,22%)',
                            fontSize: 14,
                            height: 28,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          {/* Summary — extractive TF-IDF summary */}
          {result.summary && (
            <Box sx={{
              borderRadius: '12px',
              border: '1px solid hsl(35,20%,78%)',
              bgcolor: 'hsl(40,35%,96%)',
              p: 2.5,
              position: 'relative',
              ...fadeUp(0.07),
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <FormatQuoteIcon sx={{ fontSize: 18, color: 'hsl(35,50%,50%)' }} />
                <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                  Summary
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ color: 'hsl(0,0%,18%)', lineHeight: 1.65, fontStyle: 'italic' }}>
                {result.summary}
              </Typography>
            </Box>
          )}

          {/* Explanation — what drove the score */}
          {result.explanation && (
            <Box sx={{
              borderRadius: '12px',
              border: '1px solid hsl(35,20%,78%)',
              bgcolor: 'hsl(40,35%,96%)',
              p: 2.5,
              ...fadeUp(0.09),
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <InfoIcon sx={{ fontSize: 18, color: 'hsl(210,25%,48%)' }} />
                <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                  What drove this score
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'hsl(0,0%,22%)', lineHeight: 1.65 }}>
                {result.explanation}
              </Typography>
            </Box>
          )}

          {/* Stats row */}
          <Grid container spacing={2} sx={fadeUp(0.1)}>
            <Grid size={{ xs: 12, md: 4 }}>
              <StatsCard
                label="Overall Score"
                value={displayScore}
                icon={AnalyticsIcon}
                glow={displayScore >= 57.5 ? 'green' : undefined}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <StatsCard label="Items Analysed" value={result.items_analysed} icon={CheckCircleIcon} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <StatsCard label="Star Rating" value={result.overall_rating} icon={TagIcon} glow="purple" />
            </Grid>
          </Grid>

          {/* Competitor Gap */}
          {competitor && competitor.competitors?.length > 0 && (
            <Box sx={{
              borderRadius: '12px',
              border: '1px solid hsl(35,20%,78%)',
              bgcolor: 'hsl(40,35%,96%)',
              overflow: 'hidden',
              ...fadeUp(0.12),
            }}>
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid hsl(35,20%,78%)', bgcolor: 'rgba(0,0,0,0.035)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmojiEventsIcon sx={{ fontSize: 18, color: 'hsl(38,55%,48%)' }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                    Competitor Gap
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }}>
                    Ranked among {competitor.total_in_category} businesses in {competitor.category_group?.replace(/_/g, ' ') || competitor.category}
                  </Typography>
                </Box>
              </Box>

              {/* Headline stats */}
              <Box sx={{ px: 2.5, py: 2, display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: 2, borderBottom: '1px solid hsl(35,20%,75%)' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 13, display: 'block', mb: 0.5 }}>Your Rank</Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                    {competitor.rank}<Typography component="span" variant="body2" sx={{ color: 'hsl(0,0%,40%)', ml: 0.5 }}>/ {competitor.total_in_category}</Typography>
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 13, display: 'block', mb: 0.5 }}>Gap to Leader</Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ fontFamily: '"Sora", sans-serif', color: competitor.gap_to_leader === 0 ? 'hsl(95,25%,42%)' : 'hsl(38,55%,48%)' }}>
                    {competitor.gap_to_leader === 0 ? 'Leader' : `−${competitor.gap_to_leader?.toFixed(1)}`}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 13, display: 'block', mb: 0.5 }}>Your Score</Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ fontFamily: '"Sora", sans-serif', color: scoreColor(competitor.your_score) }}>
                    {competitor.your_score?.toFixed(1)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 13, display: 'block', mb: 0.5 }}>Category Avg</Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                    {competitor.category_average?.toFixed(1)}
                  </Typography>
                </Box>
              </Box>

              {/* Competitor list */}
              {competitor.competitors.map((c, i) => {
                const isYou = c.business_name === competitor.business_name;
                const rank = i + 1;
                const c1 = scoreColor(c.score);
                return (
                  <Box key={`${c.business_name}-${c.location}-${i}`} sx={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 110px 130px',
                    gap: 2, px: 2.5, py: 1.5,
                    borderBottom: i < competitor.competitors.length - 1 ? '1px solid hsl(35,20%,75%)' : 'none',
                    bgcolor: isYou ? 'rgba(120,135,90,0.08)' : 'transparent',
                    alignItems: 'center',
                  }}>
                    <Box sx={{
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700,
                      bgcolor: rank === 1 ? 'rgba(180,140,60,0.12)' : 'rgba(0,0,0,0.05)',
                      color: rank === 1 ? '#b8860b' : 'hsl(0,0%,35%)',
                      border: rank === 1 ? '1px solid rgba(180,140,60,0.35)' : '1px solid hsl(35,20%,78%)',
                    }}>
                      {rank}
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={isYou ? 700 : 500} sx={{ color: isYou ? 'hsl(95,25%,42%)' : 'hsl(0,0%,12%)' }}>
                        {c.business_name}{isYou && ' (you)'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }}>{c.location}</Typography>
                    </Box>
                    <SentimentBadge score={c.score} size="sm" />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.07)' }}>
                        <Box sx={{ height: '100%', width: `${c.score}%`, borderRadius: 2, bgcolor: c1 }} />
                      </Box>
                      <Typography variant="body2" sx={{ color: c1, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>
                        {Math.round(c.score)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Source Comparison */}
          {result.breakdown?.length > 0 && (() => {
            const grouped = {};
            result.breakdown.forEach((item) => {
              const lbl = sourceLabel(item.source);
              if (!grouped[lbl]) grouped[lbl] = { scores: [], source: item.source };
              grouped[lbl].scores.push(item.score);
            });
            const chartData = Object.entries(grouped).map(([name, { scores, source }]) => ({
              name,
              avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
              count: scores.length,
              color: sourceColor(source),
            }));
            if (chartData.length < 2) return null;
            return (
              <Box sx={{ borderRadius: '12px', border: '1px solid hsl(35,20%,78%)', bgcolor: 'hsl(40,35%,96%)', overflow: 'hidden', ...fadeUp(0.13) }}>
                <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid hsl(35,20%,78%)', bgcolor: 'rgba(0,0,0,0.035)' }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                    Source Comparison
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }}>
                    Average sentiment score per source
                  </Typography>
                </Box>
                <Box sx={{ px: 2.5, py: 2 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} barSize={36}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(35,20%,75%)" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(0,0%,35%)" tick={{ fill: 'hsl(0,0%,35%)', fontSize: 15 }} />
                      <YAxis domain={[0, 100]} stroke="hsl(0,0%,35%)" tick={{ fill: 'hsl(0,0%,35%)', fontSize: 14 }} width={32} />
                      <ReTooltip
                        contentStyle={{ backgroundColor: 'hsl(40,35%,96%)', border: '1px solid hsl(35,20%,78%)', borderRadius: 8, color: 'hsl(0,0%,12%)' }}
                        formatter={(value, _, props) => [`${value}/100 (${props.payload.count} items)`, 'Avg Score']}
                      />
                      <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', mt: 1 }}>
                    {chartData.map((d) => (
                      <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: d.color }} />
                        <Typography variant="caption" sx={{ color: 'hsl(0,0%,35%)' }}>
                          {d.name} — {d.avg}/100
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            );
          })()}

          {/* Stock — only when business is publicly listed */}
          {stock && stock.price_history?.length > 0 && (() => {
            const up = (stock.quote?.change_percent ?? 0) >= 0;
            const lineColor = up ? 'hsl(95,25%,42%)' : 'hsl(10,50%,45%)';
            return (
              <Box sx={{
                borderRadius: '12px', border: '1px solid hsl(35,20%,78%)',
                bgcolor: 'hsl(40,35%,96%)', overflow: 'hidden', ...fadeUp(0.14),
              }}>
                <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid hsl(35,20%,78%)', bgcolor: 'rgba(0,0,0,0.035)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ShowChartIcon sx={{ fontSize: 18, color: lineColor }} />
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                        Stock Price — {stock.symbol}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }}>
                        {stock.history_days} days of trading history
                      </Typography>
                    </Box>
                  </Box>
                  {stock.quote && (
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                      <Typography variant="h6" fontWeight={700} sx={{ color: 'hsl(0,0%,12%)', fontFamily: '"Sora", sans-serif' }}>
                        ${stock.quote.current_price?.toFixed(2)}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: lineColor }}>
                        {up ? '▲' : '▼'} {Math.abs(stock.quote.change_percent ?? 0).toFixed(2)}%
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Day range strip */}
                {stock.quote && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, px: 2.5, py: 1.5, borderBottom: '1px solid hsl(35,20%,75%)' }}>
                    {[
                      ['Open', stock.quote.open],
                      ['High', stock.quote.high],
                      ['Low',  stock.quote.low],
                      ['Prev Close', stock.quote.prev_close],
                    ].map(([label, value]) => (
                      <Box key={label}>
                        <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', display: 'block', fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ color: 'hsl(0,0%,12%)' }}>
                          ${value?.toFixed(2)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Price history chart */}
                <Box sx={{ px: 2.5, py: 2 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={stock.price_history}>
                      <defs>
                        <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={lineColor} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(35,20%,75%)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(0,0%,35%)"
                        tick={{ fill: 'hsl(0,0%,35%)', fontSize: 13 }}
                        minTickGap={40}
                      />
                      <YAxis
                        stroke="hsl(0,0%,35%)"
                        tick={{ fill: 'hsl(0,0%,35%)', fontSize: 13 }}
                        domain={['dataMin', 'dataMax']}
                        width={48}
                        tickFormatter={(v) => `$${Math.round(v)}`}
                      />
                      <ReTooltip
                        contentStyle={{ backgroundColor: 'hsl(40,35%,96%)', border: '1px solid hsl(35,20%,78%)', borderRadius: 8, color: 'hsl(0,0%,12%)' }}
                        formatter={(value, key) => [`$${Number(value).toFixed(2)}`, key]}
                      />
                      <Line type="monotone" dataKey="close" stroke={lineColor} strokeWidth={2} dot={false} name="Close" />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            );
          })()}

          {/* Breakdown */}
          {result.breakdown?.length > 0 && (
            <Box sx={{
              borderRadius: '12px',
              border: '1px solid hsl(35,20%,78%)',
              bgcolor: 'hsl(40,35%,96%)',
              overflow: 'hidden',
              ...fadeUp(0.15),
            }}>
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid hsl(35,20%,78%)', bgcolor: 'rgba(0,0,0,0.035)' }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                  Source Breakdown
                </Typography>
                <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }}>
                  {result.breakdown.length} items from reviews, news and social media
                </Typography>
              </Box>

              {result.breakdown.map((item, i) => {
                const ds = item.score;
                const color = scoreColor(ds);
                const src = sourceLabel(item.source);
                const srcColor = sourceColor(item.source);
                const fullText = item.body || item.text || '';
                const isExpanded = expandedItems.has(i);
                const TRUNCATE = 220;
                const isTruncatable = fullText.length > TRUNCATE;
                const previewText = isTruncatable ? `${fullText.slice(0, TRUNCATE).trimEnd()}…` : fullText;

                return (
                  <Box
                    key={i}
                    onClick={() => toggleExpanded(i)}
                    sx={{
                      px: 2.5, py: 2,
                      borderBottom: i < result.breakdown.length - 1 ? '1px solid hsl(35,20%,75%)' : 'none',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.025)' },
                      transition: 'background 0.15s',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      {/* Source pill */}
                      <Box sx={{
                        px: 1, py: 0.25, borderRadius: '4px',
                        bgcolor: `${srcColor}18`,
                        border: `1px solid ${srcColor}40`,
                        flexShrink: 0,
                      }}>
                        <Typography variant="caption" sx={{ color: srcColor, fontWeight: 600, fontSize: 15, letterSpacing: 0.5 }}>
                          {src.toUpperCase()}
                        </Typography>
                      </Box>

                      {/* Score badge */}
                      <SentimentBadge score={ds} size="sm" />

                      {/* Score bar */}
                      <Box sx={{ flex: 1, height: 5, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                        <Box sx={{
                          height: '100%',
                          width: `${ds}%`,
                          borderRadius: 3,
                          bgcolor: color,
                          boxShadow: `0 0 8px ${color}60`,
                          transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                        }} />
                      </Box>

                      <Typography variant="body2" sx={{ color, fontWeight: 700, minWidth: 28, textAlign: 'right', flexShrink: 0 }}>
                        {Math.round(ds)}
                      </Typography>

                      {/* Chevron — rotates when expanded */}
                      <ExpandMoreIcon sx={{
                        color: 'hsl(0,0%,45%)',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                      }} />
                    </Box>

                    {/* Title (when present) is always visible above the body */}
                    {item.title && (
                      <Typography variant="body1" fontWeight={600} sx={{ color: 'hsl(0,0%,15%)', mb: 0.5, pl: 0.5 }}>
                        {item.title}
                      </Typography>
                    )}

                    {/* Body — truncated by default, full when expanded */}
                    <Typography variant="body1" sx={{ color: 'hsl(0,0%,25%)', lineHeight: 1.6, pl: 0.5 }}>
                      {isExpanded || !isTruncatable ? (fullText || '—') : previewText}
                    </Typography>

                    {/* Expanded details — rating + external link */}
                    <Collapse in={isExpanded} timeout={250} unmountOnExit>
                      <Box sx={{
                        mt: 1.5, pl: 0.5,
                        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
                      }}>
                        {item.rating != null && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, fontSize: 14 }}>
                              Rating
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'hsl(0,0%,20%)', fontWeight: 600 }}>
                              {'⭐'.repeat(Math.round(item.rating))} ({item.rating}/5)
                            </Typography>
                          </Box>
                        )}
                        {item.url ? (
                          <Link
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            underline="hover"
                            sx={{
                              display: 'inline-flex', alignItems: 'center', gap: 0.5,
                              color: 'hsl(15,45%,38%)', fontWeight: 600, fontSize: 15,
                              '&:hover': { color: 'hsl(15,45%,28%)' },
                            }}
                          >
                            View original source
                            <OpenInNewIcon sx={{ fontSize: 16 }} />
                          </Link>
                        ) : (
                          <Typography variant="caption" sx={{ color: 'hsl(0,0%,50%)', fontStyle: 'italic' }}>
                            No external link for this item.
                          </Typography>
                        )}
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
