import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import ShareIcon from '@mui/icons-material/Share';
import CheckIcon from '@mui/icons-material/Check';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CategoryIcon from '@mui/icons-material/Category';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DownloadIcon from '@mui/icons-material/Download';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis,
} from 'recharts';
import { ScoreGauge } from '../components/ScoreGauge';
import { SentimentBadge } from '../components/SentimentBadge';
import { API } from '../api/config';
import { readSnapshotFromHash, clearSnapshotHash, formatSnapshotDate } from '../utils/snapshot';

// Calls without auth — requires backend to allow public read on sentiment/history
function publicFetch(path) {
  // Fall back to a saved token if the user happens to be logged in
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

const scoreColor = (s) => {
  if (s >= 57.5) return 'hsl(95,25%,42%)';
  if (s >= 42.5) return 'hsl(38,55%,48%)';
  return 'hsl(10,50%,45%)';
};

const sourceLabel = (s) => {
  if (s === 'google_maps_reviews') return 'Review';
  if (s === 'newsapi') return 'News';
  if (s === 'reddit') return 'Reddit';
  if (s === 'google_news_rss') return 'Google News';
  return s || '—';
};

const fadeUp = (delay = 0) => ({
  '@keyframes fadeUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to:   { opacity: 1, transform: 'translateY(0)' },
  },
  animation: `fadeUp 0.5s ease ${delay}s both`,
});

export default function ScoreCardPage() {
  const { name } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const location = searchParams.get('location') || '';
  const category = searchParams.get('category') || '';
  const decodedName = decodeURIComponent(name);

  // Read any embedded snapshot on first render — if present we skip the fetch entirely.
  const initialSnapshot = useState(() => readSnapshotFromHash())[0];

  const [sentiment, setSentiment] = useState(initialSnapshot?.sentiment ?? null);
  const [history, setHistory]     = useState(() => {
    if (!initialSnapshot?.sentiment) return [];
    // We don't store the history array in the snapshot — but the breakdown drives
    // most of the page, so leave history empty in snapshot mode (sparkline hides).
    return [];
  });
  const [loading, setLoading]     = useState(!initialSnapshot);
  const [error, setError]         = useState('');
  const [copied, setCopied]       = useState(false);
  const [snapshotDate, setSnapshotDate] = useState(initialSnapshot?.snapshotDate ?? null);
  const isSnapshot = !!snapshotDate;

  useEffect(() => {
    // Update page title + Open Graph tags for social sharing
    document.title = `${decodedName} — Ghostie Score`;
    const setMeta = (property, content) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('og:title', `${decodedName} — Ghostie Score`);
    setMeta('og:description', `See ${decodedName}'s public sentiment score powered by Ghostie.`);
    setMeta('og:url', window.location.href);
    return () => { document.title = 'Ghostie'; };
  }, [decodedName]);

  useEffect(() => {
    // Snapshot was loaded synchronously above — skip the network entirely.
    if (initialSnapshot) return;

    const params = new URLSearchParams({ business_name: decodedName, location, category });
    Promise.all([
      publicFetch(`/analyse?${params}`).then((r) => r.json()),
      publicFetch(`/analytical-model/history?${params}`).then((r) => r.json()).catch(() => ({})),
    ]).then(([sent, hist]) => {
      if (sent.detail) throw new Error(sent.detail);
      setSentiment(sent);
      const results = hist.results ?? [];
      const byDate = new Map();
      [...results].reverse().forEach((r) => {
        const label = new Date(r.date_time).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
        byDate.set(label, r.overall_score);
      });
      setHistory(Array.from(byDate.entries()).map(([date, score]) => ({ date, score })));
      setLoading(false);
    }).catch((err) => {
      setError(err.message || 'Could not load scorecard.');
      setLoading(false);
    });
  }, [decodedName, location, category, initialSnapshot]);

  // "View live data" — strip the snapshot from the URL and refetch.
  const handleViewLive = () => {
    clearSnapshotHash();
    setSnapshotDate(null);
    setSentiment(null);
    setHistory([]);
    setLoading(true);
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    const { toPng } = await import('html-to-image');
    const { default: jsPDF } = await import('jspdf');
    const el = document.getElementById('ghostie-scorecard');
    if (!el) return;
    const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: 'hsl(40,30%,88%)' });
    const img = new Image();
    img.src = dataUrl;
    await new Promise((res) => { img.onload = res; });
    const pw = img.naturalWidth / 2;
    const ph = img.naturalHeight / 2;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [pw, ph] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, pw, ph);
    pdf.save(`${decodedName}-ghostie-scorecard.pdf`);
  };

  const score = sentiment?.overall_score ?? null;
  const color = score !== null ? scoreColor(score) : 'hsl(0,0%,35%)';

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'hsl(40,30%,88%)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .ghostie-no-print { display: none !important; }
          #ghostie-overlay-root { display: none !important; }
        }
      `}</style>
      {/* Top bar */}
      <Box className="ghostie-no-print" sx={{
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
            Business Sentiment Intelligence
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          endIcon={<OpenInNewIcon sx={{ fontSize: 17 }} />}
          onClick={() => navigate('/signin')}
          sx={{ fontSize: 15, borderColor: 'hsl(35,20%,82%)', color: 'hsl(0,0%,25%)', '&:hover': { borderColor: 'hsl(95,25%,42%)', color: 'hsl(95,25%,42%)' } }}
        >
          Sign in to analyse
        </Button>
      </Box>

      {/* Snapshot notice — only when rendering from an embedded snapshot */}
      {isSnapshot && (
        <Box className="ghostie-no-print" sx={{
          maxWidth: 800, mx: 'auto', width: '100%', px: { xs: 2, md: 4 }, mt: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1,
          color: 'hsl(0,0%,30%)',
        }}>
          <Typography variant="caption" sx={{ fontSize: 14 }}>
            📌 Snapshot from {formatSnapshotDate(snapshotDate)} — the data below was captured at that time.
          </Typography>
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
        </Box>
      )}

      {/* Main content */}
      <Box sx={{ flex: 1, maxWidth: 800, mx: 'auto', width: '100%', px: { xs: 2, md: 4 }, py: 4 }}>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <CircularProgress sx={{ color: 'hsl(95,25%,42%)' }} />
          </Box>
        )}

        {error && (
          <Box sx={{ mt: 4 }}>
            <Alert severity="error">{error}</Alert>
            <Typography variant="body2" sx={{ color: 'hsl(0,0%,40%)', mt: 2, textAlign: 'center' }}>
              This company may not have been analysed yet.{' '}
              <Box component="span"
                onClick={() => navigate('/signin')}
                sx={{ color: 'hsl(95,25%,42%)', cursor: 'pointer', textDecoration: 'underline' }}>
                Sign in to run an analysis.
              </Box>
            </Typography>
          </Box>
        )}

        {!loading && sentiment && (
          <>
          <Box id="ghostie-scorecard">
            {/* Hero card */}
            <Box id="ghostie-hero-card" sx={{
              ...fadeUp(0),
              borderRadius: '20px',
              border: `1px solid ${color}33`,
              bgcolor: 'hsl(40,35%,96%)',
              p: { xs: 3, md: 4 },
              mb: 3,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Glow blob */}
              <Box sx={{
                position: 'absolute', top: -80, right: -80, width: 280, height: 280,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />

              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 4, position: 'relative' }}>
                <ScoreGauge score={score} size={180} label="Ghostie Score" />

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h3" fontWeight={800} sx={{
                    fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)',
                    lineHeight: 1.2, mb: 1,
                  }}>
                    {sentiment.business_name}
                  </Typography>

                  <SentimentBadge score={score} size="lg" />

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1.5 }}>
                    {location && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <LocationOnIcon sx={{ fontSize: 17, color: 'hsl(0,0%,45%)' }} />
                        <Typography variant="body2" sx={{ color: 'hsl(0,0%,30%)' }}>{location}</Typography>
                      </Box>
                    )}
                    {category && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <CategoryIcon sx={{ fontSize: 17, color: 'hsl(0,0%,45%)' }} />
                        <Typography variant="body2" sx={{ color: 'hsl(0,0%,30%)' }}>{category}</Typography>
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 3, mt: 2.5, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'hsl(0,0%,45%)', textTransform: 'uppercase', letterSpacing: 1, fontSize: 13, display: 'block' }}>Items</Typography>
                      <Typography variant="h6" fontWeight={700} sx={{ color: 'hsl(0,0%,12%)', fontFamily: '"Sora", sans-serif' }}>
                        {sentiment.items_analysed}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'hsl(0,0%,45%)', textTransform: 'uppercase', letterSpacing: 1, fontSize: 13, display: 'block' }}>Rating</Typography>
                      <Typography variant="h6" fontWeight={700} sx={{ color: 'hsl(0,0%,12%)', fontFamily: '"Sora", sans-serif' }}>
                        {sentiment.overall_rating}/5
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'hsl(0,0%,45%)', textTransform: 'uppercase', letterSpacing: 1, fontSize: 13, display: 'block' }}>Score</Typography>
                      <Typography variant="h6" fontWeight={700} sx={{ color, fontFamily: '"Sora", sans-serif' }}>
                        {Math.round(score)}/100
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Trend sparkline */}
            {history.length > 1 && (
              <Box sx={{
                ...fadeUp(0.08),
                borderRadius: '16px', border: '1px solid hsl(35,20%,78%)',
                bgcolor: 'hsl(40,35%,96%)', p: 2.5, mb: 3,
              }}>
                <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, display: 'block', mb: 1.5 }}>
                  Score Trend
                </Typography>
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <ReTooltip
                      contentStyle={{ backgroundColor: 'hsl(40,35%,98%)', border: '1px solid hsl(35,20%,78%)', borderRadius: 8, fontSize: 15 }}
                      labelStyle={{ color: 'hsl(0,0%,12%)' }}
                    />
                    <Area type="monotone" dataKey="score" stroke={color} strokeWidth={2} fill="url(#sparkGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            )}

            {/* Summary — extractive TF-IDF summary */}
            {sentiment.summary && (
              <Box sx={{
                ...fadeUp(0.1),
                borderRadius: '16px', border: '1px solid hsl(35,20%,78%)',
                bgcolor: 'hsl(40,35%,96%)', p: 2.5, mb: 3,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <FormatQuoteIcon sx={{ fontSize: 18, color: 'hsl(35,50%,50%)' }} />
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                    Summary
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'hsl(0,0%,18%)', lineHeight: 1.65, fontStyle: 'italic' }}>
                  {sentiment.summary}
                </Typography>
              </Box>
            )}

            {/* Explanation — what drove the score */}
            {sentiment.explanation && (
              <Box sx={{
                ...fadeUp(0.11),
                borderRadius: '16px', border: '1px solid hsl(35,20%,78%)',
                bgcolor: 'hsl(40,35%,96%)', p: 2.5, mb: 3,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <InfoIcon sx={{ fontSize: 18, color: 'hsl(210,25%,48%)' }} />
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                    What drove this score
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'hsl(0,0%,22%)', lineHeight: 1.65 }}>
                  {sentiment.explanation}
                </Typography>
              </Box>
            )}

            {/* Keywords — split by polarity when available */}
            {(sentiment.keyword_split?.positive?.length > 0 || sentiment.keyword_split?.negative?.length > 0) ? (
              <Box sx={{ ...fadeUp(0.12), mb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {sentiment.keyword_split.positive?.length > 0 && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <TrendingUpIcon sx={{ fontSize: 17, color: 'hsl(95,25%,42%)' }} />
                      <Typography variant="caption" sx={{ color: 'hsl(95,25%,42%)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                        Positive Signals
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {sentiment.keyword_split.positive.map((kw) => (
                        <Chip key={`pos-${kw}`} label={kw} size="small" sx={{
                          bgcolor: 'rgba(120,135,90,0.14)', border: '1px solid hsl(95,25%,32%)',
                          color: 'hsl(95,25%,55%)', fontSize: 16, height: 32,
                        }} />
                      ))}
                    </Box>
                  </Box>
                )}
                {sentiment.keyword_split.negative?.length > 0 && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <TrendingDownIcon sx={{ fontSize: 17, color: 'hsl(10,50%,45%)' }} />
                      <Typography variant="caption" sx={{ color: 'hsl(10,50%,45%)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                        Negative Signals
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {sentiment.keyword_split.negative.map((kw) => (
                        <Chip key={`neg-${kw}`} label={kw} size="small" sx={{
                          bgcolor: 'rgba(180,80,60,0.12)', border: '1px solid hsl(10,50%,30%)',
                          color: 'hsl(10,50%,55%)', fontSize: 16, height: 32,
                        }} />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            ) : sentiment.keywords?.length > 0 && (
              <Box sx={{ ...fadeUp(0.12), mb: 3 }}>
                <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, display: 'block', mb: 1.5 }}>
                  Top Keywords
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {sentiment.keywords.map((kw) => (
                    <Chip key={kw} label={kw} size="small" sx={{
                      bgcolor: `${color}15`, border: `1px solid ${color}35`,
                      color: 'hsl(0,0%,20%)', fontSize: 16, height: 32,
                    }} />
                  ))}
                </Box>
              </Box>
            )}

            {/* Source breakdown */}
            {sentiment.breakdown?.length > 0 && (
              <Box sx={{
                ...fadeUp(0.16),
                borderRadius: '16px', border: '1px solid hsl(35,20%,78%)',
                bgcolor: 'hsl(40,35%,96%)', overflow: 'hidden', mb: 3,
              }}>
                <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid hsl(35,20%,78%)', bgcolor: 'rgba(0,0,0,0.035)' }}>
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                    Source Breakdown (top {Math.min(sentiment.breakdown.length, 5)})
                  </Typography>
                </Box>
                {sentiment.breakdown.slice(0, 5).map((item, i) => {
                  const c = scoreColor(item.score);
                  return (
                    <Box key={i} sx={{
                      px: 2.5, py: 1.75,
                      borderBottom: i < Math.min(sentiment.breakdown.length, 5) - 1 ? '1px solid hsl(35,20%,75%)' : 'none',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
                        <Box sx={{ px: 1, py: 0.2, borderRadius: '4px', bgcolor: `${c}18`, border: `1px solid ${c}40`, flexShrink: 0 }}>
                          <Typography sx={{ color: c, fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>
                            {sourceLabel(item.source).toUpperCase()}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.07)' }}>
                          <Box sx={{ height: '100%', width: `${item.score}%`, borderRadius: 2, bgcolor: c, transition: 'width 1s ease' }} />
                        </Box>
                        <Typography variant="body2" sx={{ color: c, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>
                          {Math.round(item.score)}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'hsl(0,0%,30%)', lineHeight: 1.5 }}>
                        {(item.body || item.text || '').slice(0, 160)}{(item.body || item.text || '').length > 160 ? '…' : ''}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}

          </Box>

          {/* Actions — outside scorecard so they're not captured in the PDF */}
          <Box className="ghostie-no-print" sx={{ ...fadeUp(0.2), display: 'flex', gap: 2, flexWrap: 'wrap', mt: 3 }}>
            <Tooltip title={copied ? 'Copied!' : 'Copy link to share'}>
              <Button
                variant="outlined"
                startIcon={copied ? <CheckIcon /> : <ShareIcon />}
                onClick={handleShare}
                sx={{
                  borderColor: copied ? 'hsl(95,25%,42%)' : 'hsl(35,20%,82%)',
                  color: copied ? 'hsl(95,25%,42%)' : 'hsl(0,0%,25%)',
                  transition: 'all 0.2s',
                }}
              >
                {copied ? 'Link copied' : 'Share scorecard'}
              </Button>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{ borderColor: 'hsl(35,20%,82%)', color: 'hsl(0,0%,25%)', '&:hover': { borderColor: 'hsl(0,0%,45%)', color: 'hsl(0,0%,12%)' } }}
            >
              Download PDF
            </Button>
            <Button
              variant="contained"
              endIcon={<AnalyticsIcon />}
              onClick={() => navigate('/signin')}
              sx={{
                background: 'linear-gradient(135deg, hsl(15,45%,45%), hsl(15,45%,38%))',
                '&:hover': { background: 'linear-gradient(135deg, hsl(15,45%,48%), hsl(15,45%,42%))' },
              }}
            >
              Analyse with Ghostie
            </Button>
          </Box>
          </>
        )}
      </Box>

      {/* Footer */}
      <Divider className="ghostie-no-print" sx={{ borderColor: 'hsl(35,20%,72%)' }} />
      <Box className="ghostie-no-print" sx={{ px: 4, py: 2, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'hsl(0,0%,50%)' }}>
          Powered by{' '}
          <Box component="span" sx={{ color: 'hsl(95,25%,40%)', fontWeight: 600 }}>Ghostie</Box>
          {' '}— Public sentiment data. Scores update when new data is collected.
        </Typography>
      </Box>
    </Box>
  );
}
