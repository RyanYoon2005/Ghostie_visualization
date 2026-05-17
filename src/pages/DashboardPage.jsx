import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TrophyIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import BarChartIcon from '@mui/icons-material/BarChart';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReviewsIcon from '@mui/icons-material/Reviews';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import ForumIcon from '@mui/icons-material/Forum';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import SearchIcon from '@mui/icons-material/Search';
import { SentimentBadge } from '../components/SentimentBadge';
import { StatsCard } from '../components/StatsCard';
import { EmptyState } from '../components/EmptyState';
import { makeApiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useBusiness } from '../context/BusinessContext';

// Animation helpers
const fadeUp = (delay = 0) => ({
  '@keyframes fadeUp': {
    from: { opacity: 0, transform: 'translateY(24px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  animation: 'fadeUp 0.55s ease-out forwards',
  animationDelay: `${delay}s`,
  opacity: 0,
});

const GLASS = {
  borderRadius: '16px',
  border: '1px solid hsl(35,20%,78%)',
  bgcolor: 'hsl(40,35%,96%)',
  overflow: 'hidden',
};

async function computeKey(name, location, category) {
  const raw = `${name}${location}${category}`.toLowerCase().replace(/ /g, '');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function ScoreBar({ score }) {
  const color = score >= 57.5 ? 'hsl(95,25%,42%)' : score >= 42.5 ? 'hsl(38,55%,48%)' : 'hsl(10,50%,45%)';
  return (
    <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <Box sx={{
        height: '100%', borderRadius: 2, bgcolor: color,
        width: `${score}%`,
        transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: `0 0 8px ${color}66`,
      }} />
    </Box>
  );
}

export default function DashboardPage() {
  const { token, user } = useAuth();
  const api = makeApiClient(token);
  const navigate = useNavigate();
  const { setSentimentBusiness } = useBusiness();

  const [leaderboard, setLeaderboard] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api('/analytical-model/leaderboard').then((r) => r.json()),
      api('/users/me/favourites').then((r) => r.json()),
      api('/data-retrieval/companies').then((r) => r.json()),
      api('/trending?limit=8').then((r) => r.ok ? r.json() : { trending: [] }).catch(() => ({ trending: [] })),
    ]).then(([lb, favs, comps, trend]) => {
      setLeaderboard(lb.leaderboard ?? []);
      setFavourites(favs.favourited ?? []);
      setCompanies(comps.companies ?? []);
      setTrending(trend.trending ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const [favouritedCompanies, setFavouritedCompanies] = useState([]);
  useEffect(() => {
    if (companies.length === 0 || favourites.length === 0) return;
    Promise.all(companies.map(async (c) => ({ ...c, key: await computeKey(c.business_name, c.location, c.category) })))
      .then((withKeys) => setFavouritedCompanies(withKeys.filter((c) => favourites.includes(c.key)).slice(0, 4)));
  }, [companies, favourites]);

  const avgScore = leaderboard.length
    ? Math.round(leaderboard.reduce((a, b) => a + (Number(b.overall_score) || 0), 0) / leaderboard.length * 10) / 10
    : 0;

  const goToSentiment = (biz) => {
    setSentimentBusiness({ business_name: biz.business_name, location: biz.location, category: biz.category });
    navigate('/sentiment');
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', gap: 3,
      // The marquee child uses `width: max-content` so its intrinsic size is large.
      // Clipping at the page root guarantees the dashboard never exceeds its
      // container — no horizontal scroll regardless of what sits inside.
      width: '100%',
      overflowX: 'hidden',
    }}>

      {/* ── Hero: animated Ghostie + cycling-sources ribbon ── */}
      <Box sx={{
        ...fadeUp(0),
        position: 'relative', borderRadius: '20px', overflow: 'hidden',
        pt: { xs: 4, md: 5 }, pb: 0,
        background: 'linear-gradient(135deg, hsl(40,35%,94%) 0%, hsl(38,40%,90%) 50%, hsl(35,30%,86%) 100%)',
        border: '1px solid hsl(35,20%,78%)',
      }}>
        {/* Decorative blobs */}
        <Box sx={{
          position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(160,90,60,0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <Box sx={{
          position: 'absolute', bottom: -40, left: '20%', width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(180,140,60,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Floating Ghostie + greeting */}
        <Box sx={{
          position: 'relative',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          px: 3, gap: 1.5,
        }}>
          {/* Animated logo */}
          <Box sx={{
            '@keyframes ghostie-float': {
              '0%':   { transform: 'translateY(0)    rotate(-3deg)' },
              '50%':  { transform: 'translateY(-14px) rotate(3deg)' },
              '100%': { transform: 'translateY(0)    rotate(-3deg)' },
            },
            '@keyframes ghostie-shadow': {
              '0%':   { transform: 'translateX(-50%) scale(1)',    opacity: 0.32 },
              '50%':  { transform: 'translateX(-50%) scale(0.78)', opacity: 0.18 },
              '100%': { transform: 'translateX(-50%) scale(1)',    opacity: 0.32 },
            },
            position: 'relative',
            width: 120, height: 130,
            display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          }}>
            {/* Soft ground shadow that shrinks/expands with the bob */}
            <Box sx={{
              position: 'absolute', bottom: 4, left: '50%',
              width: 70, height: 12, borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(160,90,60,0.45) 0%, transparent 70%)',
              transformOrigin: 'center',
              animation: 'ghostie-shadow 4s ease-in-out infinite',
              transform: 'translateX(-50%)',
            }} />
            <Box sx={{
              animation: 'ghostie-float 4s ease-in-out infinite',
              filter: 'drop-shadow(0 6px 14px rgba(160,90,60,0.28))',
            }}>
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C7.03 2 3 6.03 3 11v9l3-3 3 3 3-3 3 3 3-3v-9c0-4.97-4.03-9-9-9z" fill="url(#dash-ghost-grad)"/>
                <circle cx="9"  cy="11" r="1.5" fill="hsl(40,35%,96%)"/>
                <circle cx="15" cy="11" r="1.5" fill="hsl(40,35%,96%)"/>
                <defs>
                  <linearGradient id="dash-ghost-grad" x1="3" y1="2" x2="21" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="hsl(15,45%,45%)"/>
                    <stop offset="100%" stopColor="hsl(35,45%,45%)"/>
                  </linearGradient>
                </defs>
              </svg>
            </Box>
          </Box>

          <Typography variant="h3" fontWeight={800} sx={{
            fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)', lineHeight: 1.2,
          }}>
            {greeting}{user?.username ? `, ${user.username}` : ''}
          </Typography>
          <Typography variant="body1" sx={{ color: 'hsl(0,0%,35%)', maxWidth: 520 }}>
            Your business intelligence platform. Track sentiment, monitor trends, and discover insights.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Chip
              icon={<TrendingUpIcon sx={{ fontSize: '14px !important' }} />}
              label={`${leaderboard.length} companies tracked`}
              size="small"
              sx={{ bgcolor: 'rgba(120,135,90,0.14)', color: 'hsl(95,25%,32%)', border: '1px solid rgba(120,135,90,0.30)', fontSize: 15 }}
            />
            <Chip
              icon={<StarIcon sx={{ fontSize: '14px !important' }} />}
              label={`${favourites.length} favourites`}
              size="small"
              sx={{ bgcolor: 'rgba(180,140,60,0.14)', color: 'hsl(35,50%,32%)', border: '1px solid rgba(180,140,60,0.30)', fontSize: 15 }}
            />
            {!loading && (
              <Chip
                icon={<AnalyticsIcon sx={{ fontSize: '14px !important' }} />}
                label={`Platform avg ${avgScore}/100`}
                size="small"
                sx={{ bgcolor: 'rgba(160,90,60,0.10)', color: 'hsl(15,45%,32%)', border: '1px solid rgba(160,90,60,0.25)', fontSize: 15 }}
              />
            )}
          </Box>
        </Box>

        {/* Cycling-sources ribbon */}
        <Box sx={{
          mt: { xs: 3, md: 4 },
          py: 1.25,
          borderTop: '1px solid hsl(35,20%,75%)',
          borderBottom: '1px solid hsl(35,20%,75%)',
          bgcolor: 'rgba(160,90,60,0.05)',
          overflow: 'hidden',
          position: 'relative',
          maskImage: 'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)',
        }}>
          {(() => {
            const sources = [
              { icon: ReviewsIcon,    label: 'Google Maps Reviews', color: 'hsl(210,50%,40%)' },
              { icon: NewspaperIcon,  label: 'NewsAPI',              color: 'hsl(35,50%,40%)' },
              { icon: RssFeedIcon,    label: 'Google News RSS',      color: 'hsl(70,25%,38%)' },
              { icon: ForumIcon,      label: 'Reddit',               color: 'hsl(18,40%,42%)' },
              { icon: ShowChartIcon,  label: 'Live Stock Data',      color: 'hsl(95,25%,32%)' },
              { icon: AnalyticsIcon,  label: 'Sentiment Engine',     color: 'hsl(15,45%,40%)' },
            ];
            // Duplicate the list so the marquee loops seamlessly.
            const loop = [...sources, ...sources];
            return (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                '@keyframes ghostie-marquee': {
                  from: { transform: 'translateX(0)' },
                  to:   { transform: 'translateX(-50%)' },
                },
                animation: 'ghostie-marquee 28s linear infinite',
                width: 'max-content',
              }}>
                {loop.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Icon sx={{ fontSize: 18, color: s.color }} />
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'hsl(0,0%,25%)', fontSize: 15 }}>
                        {s.label}
                      </Typography>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'hsl(35,20%,55%)', ml: 4 }} />
                    </Box>
                  );
                })}
              </Box>
            );
          })()}
        </Box>
      </Box>

      {/* ── Stat cards ── */}
      <Grid container spacing={2}>
        {[
          { label: 'Avg Sentiment', value: loading ? 0 : avgScore, icon: BarChartIcon, glow: 'green', delay: 0.1 },
          { label: 'Companies Tracked', value: loading ? 0 : leaderboard.length, icon: TrophyIcon, glow: 'purple', delay: 0.18 },
          { label: 'Favourites', value: loading ? 0 : favourites.length, icon: StarIcon, delay: 0.26 },
        ].map(({ label, value, icon, glow, delay }) => (
          <Grid size={{ xs: 12, md: 4 }} key={label} sx={fadeUp(delay)}>
            <StatsCard label={label} value={value} icon={icon} glow={glow} />
          </Grid>
        ))}
      </Grid>

      {/* ── Top companies + Favourites ── */}
      <Grid container spacing={3}>

        {/* Top companies */}
        <Grid size={{ xs: 12, md: 7 }} sx={fadeUp(0.3)}>
          <Box sx={{ ...GLASS, height: '100%' }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid hsl(35,20%,78%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrophyIcon sx={{ fontSize: 18, color: 'hsl(38,55%,48%)' }} />
                <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                  Top Companies
                </Typography>
              </Box>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/leaderboard')}
                sx={{ color: 'hsl(95,25%,42%)', fontSize: 15, '&:hover': { bgcolor: 'rgba(120,135,90,0.10)' } }}>
                Full leaderboard
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {[1, 2, 3].map((i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Skeleton variant="circular" width={28} height={28} sx={{ bgcolor: 'rgba(0,0,0,0.06)', flexShrink: 0 }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="45%" sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />
                      <Skeleton variant="rounded" height={4} sx={{ bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 2, mt: 0.5 }} />
                    </Box>
                    <Skeleton variant="rounded" width={52} height={22} sx={{ bgcolor: 'rgba(0,0,0,0.06)', borderRadius: '6px' }} />
                  </Box>
                ))}
              </Box>
            ) : leaderboard.length === 0 ? (
              <EmptyState icon={TrophyIcon} title="No data yet" message="Run a Standard Analysis to populate the leaderboard." />
            ) : (
              <Box sx={{ p: 1 }}>
                {leaderboard.slice(0, 5).map((biz, i) => (
                  <Box
                    key={i}
                    onClick={() => goToSentiment(biz)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      px: 1.5, py: 1.5, borderRadius: '10px', cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                      transition: 'background 0.15s',
                    }}
                  >
                    <Typography variant="caption" sx={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 14,
                      bgcolor: i === 0 ? 'rgba(180,140,60,0.14)' : i === 1 ? 'rgba(180,180,180,0.1)' : i === 2 ? 'rgba(160,82,45,0.12)' : 'rgba(0,0,0,0.05)',
                      color: i === 0 ? '#b8860b' : i === 1 ? '#b4b4b4' : i === 2 ? '#a0522d' : 'hsl(0,0%,40%)',
                    }}>
                      {i + 1}
                    </Typography>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'hsl(0,0%,12%)' }} noWrap>
                        {biz.business_name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <ScoreBar score={Number(biz.overall_score) || 0} />
                        <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', flexShrink: 0, fontSize: 14 }}>
                          {biz.location}
                        </Typography>
                      </Box>
                    </Box>

                    <SentimentBadge score={Number(biz.overall_score) || 0} size="sm" />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Grid>

        {/* Favourites */}
        <Grid size={{ xs: 12, md: 5 }} sx={fadeUp(0.38)}>
          <Box sx={{ ...GLASS, height: '100%' }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid hsl(35,20%,78%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StarIcon sx={{ fontSize: 18, color: 'hsl(38,55%,48%)' }} />
                <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                  Your Favourites
                </Typography>
              </Box>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/favourites')}
                sx={{ color: 'hsl(0,0%,35%)', fontSize: 15 }}>
                View all
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[1, 2].map((i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Skeleton variant="rounded" width={36} height={36} sx={{ bgcolor: 'rgba(0,0,0,0.06)', borderRadius: '10px', flexShrink: 0 }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />
                      <Skeleton variant="text" width="40%" sx={{ bgcolor: 'rgba(0,0,0,0.04)' }} />
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : favouritedCompanies.length === 0 ? (
              <EmptyState icon={StarIcon} title="No favourites yet" message="Star businesses on the leaderboard to pin them here." />
            ) : (
              <Box sx={{ p: 1 }}>
                {favouritedCompanies.map((c) => (
                  <Box
                    key={c.key}
                    onClick={() => goToSentiment(c)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      px: 1.5, py: 1.5, borderRadius: '10px', cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                      transition: 'background 0.15s',
                    }}
                  >
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                      background: `linear-gradient(135deg, rgba(180,140,60,0.14), rgba(180,140,60,0.05))`,
                      border: '1px solid rgba(180,140,60,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 19, fontWeight: 700, color: 'hsl(38,55%,48%)',
                      fontFamily: '"Sora", sans-serif',
                    }}>
                      {c.business_name[0].toUpperCase()}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'hsl(0,0%,12%)' }} noWrap>
                        {c.business_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }} noWrap>
                        {c.location} · {c.category}
                      </Typography>
                    </Box>
                    <ArrowForwardIcon sx={{ fontSize: 17, color: 'hsl(0,0%,47%)', flexShrink: 0 }} />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* ── Trending Now ── */}
      {!loading && trending.length > 0 && (
        <Box sx={{ ...GLASS, overflow: 'hidden', ...fadeUp(0.4) }}>
          <Box sx={{
            px: 2.5, py: 2,
            borderBottom: '1px solid hsl(35,20%,78%)',
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <WhatshotIcon sx={{ fontSize: 20, color: 'hsl(15,55%,42%)' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
                Trending Now
              </Typography>
              <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }}>
                Most-searched businesses across the platform
              </Typography>
            </Box>
          </Box>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 1,
            p: 1.5,
          }}>
            {trending.slice(0, 8).map((biz, i) => (
              <Box
                key={biz.business_key ?? i}
                onClick={() => goToSentiment(biz)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 1.5, py: 1.25, borderRadius: '10px',
                  border: '1px solid hsl(35,20%,82%)',
                  bgcolor: 'rgba(160,90,60,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: 'rgba(160,90,60,0.10)', borderColor: 'hsl(15,45%,55%)' },
                }}
              >
                <Box sx={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: i < 3 ? 'rgba(160,90,60,0.18)' : 'rgba(0,0,0,0.05)',
                  color: i < 3 ? 'hsl(15,55%,32%)' : 'hsl(0,0%,40%)',
                  fontWeight: 700, fontSize: 14,
                }}>
                  {i + 1}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ color: 'hsl(0,0%,12%)' }} noWrap>
                    {biz.business_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,45%)' }} noWrap>
                    {biz.location} · {biz.category}
                  </Typography>
                </Box>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 0.75, py: 0.25, borderRadius: 1,
                  bgcolor: 'rgba(160,90,60,0.12)', flexShrink: 0,
                }}>
                  <SearchIcon sx={{ fontSize: 13, color: 'hsl(15,55%,35%)' }} />
                  <Typography variant="caption" sx={{ color: 'hsl(15,55%,30%)', fontWeight: 700, fontSize: 13 }}>
                    {biz.search_count}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* ── CTA ── */}
      <Box sx={{
        ...fadeUp(0.44),
        borderRadius: '16px', p: 3,
        background: 'linear-gradient(135deg, rgba(160,90,60,0.10) 0%, rgba(180,140,60,0.10) 100%)',
        border: '1px solid rgba(160,90,60,0.20)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap',
      }}>
        <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: 'hsl(0,0%,12%)', fontFamily: '"Sora", sans-serif' }}>
            Ready to analyse a business?
          </Typography>
          <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)', mt: 0.25 }}>
            Get a full sentiment breakdown from reviews, news, and Reddit in seconds.
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          endIcon={<AnalyticsIcon />}
          onClick={() => navigate('/sentiment')}
          sx={{
            flexShrink: 0, borderRadius: '10px',
            background: 'linear-gradient(135deg, hsl(15,45%,45%), hsl(15,45%,38%))',
            boxShadow: '0 4px 20px rgba(160,90,60,0.22)',
            '&:hover': { boxShadow: '0 6px 28px rgba(160,90,60,0.28)' },
          }}
        >
          Start Analysis
        </Button>
      </Box>
    </Box>
  );
}
