import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Skeleton from '@mui/material/Skeleton';
import InputAdornment from '@mui/material/InputAdornment';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrophyIcon from '@mui/icons-material/EmojiEvents';
import BarChartIcon from '@mui/icons-material/BarChart';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import SearchIcon from '@mui/icons-material/Search';
import { SentimentBadge } from '../components/SentimentBadge';
import { StatsCard } from '../components/StatsCard';
import { EmptyState } from '../components/EmptyState';
import { makeApiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useFavourites } from '../hooks/useFavourites';
import { useToast } from '../context/ToastContext';
import { useBusiness } from '../context/BusinessContext';

async function computeKey(name, location, category) {
  const raw = `${name}${location}${category}`.toLowerCase().replace(/ /g, '');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const rankSx = (rank) => {
  if (rank === 1) return { bgcolor: 'rgba(180,140,60,0.12)', color: '#b8860b', borderColor: 'rgba(180,140,60,0.35)' };
  if (rank === 2) return { bgcolor: 'rgba(180,180,180,0.12)', color: '#b4b4b4', borderColor: 'rgba(180,180,180,0.35)' };
  if (rank === 3) return { bgcolor: 'rgba(160,82,45,0.14)', color: '#a0522d', borderColor: 'rgba(160,82,45,0.30)' };
  return { bgcolor: 'rgba(0,0,0,0.05)', color: 'hsl(0,0%,35%)', borderColor: 'hsl(35,20%,78%)' };
};

const fadeUp = (delay = 0) => ({
  '@keyframes fadeUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to:   { opacity: 1, transform: 'translateY(0)' },
  },
  animation: `fadeUp 0.5s ease ${delay}s both`,
});

export default function LeaderboardPage() {
  const { token } = useAuth();
  const api = makeApiClient(token);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setSentimentBusiness } = useBusiness();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keys, setKeys] = useState([]);
  const [search, setSearch] = useState('');
  const { favourites, toggle } = useFavourites(api);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/analytical-model/leaderboard');
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaderboard(); }, []);

  useEffect(() => {
    const board = data?.leaderboard ?? [];
    if (board.length === 0) { setKeys([]); return; }
    Promise.all(board.map((biz) => computeKey(biz.business_name, biz.location, biz.category))).then(setKeys);
  }, [data]);

  const board = data?.leaderboard ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return board;
    const q = search.toLowerCase();
    return board.filter((b) =>
      b.business_name?.toLowerCase().includes(q) ||
      b.location?.toLowerCase().includes(q) ||
      b.category?.toLowerCase().includes(q)
    );
  }, [board, search]);

  const avgScore = board.length
    ? Math.round(board.reduce((a, b) => a + b.overall_score, 0) / board.length * 10) / 10
    : 0;
  const favCount = keys.filter((k) => favourites.has(k)).length;

  const handleToggle = (e, bizKey, bizName, isFav) => {
    e.stopPropagation();
    toggle(bizKey);
    showToast(isFav ? `Removed ${bizName} from favourites` : `Added ${bizName} to favourites`, isFav ? 'info' : 'success');
  };

  const handleRowClick = (biz) => {
    setSentimentBusiness({ business_name: biz.business_name, location: biz.location, category: biz.category });
    navigate('/sentiment');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, ...fadeUp(0) }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
            Leaderboard
          </Typography>
          <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)', mt: 0.5 }}>
            Top businesses ranked by sentiment score
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={fetchLeaderboard} variant="outlined" size="small">
          Refresh
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3, ...fadeUp(0.07) }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatsCard label="Avg Sentiment" value={loading ? 0 : avgScore} icon={BarChartIcon} glow="green" />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatsCard label="Companies Tracked" value={loading ? 0 : board.length} icon={TrophyIcon} glow="purple" />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatsCard label="Favourites" value={loading ? 0 : favCount} icon={StarIcon} />
        </Grid>
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{
        borderRadius: '12px',
        border: '1px solid hsl(35,20%,78%)',
        bgcolor: 'hsl(40,35%,96%)',
        overflow: 'hidden',
        ...fadeUp(0.14),
      }}>
        {/* Search bar */}
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid hsl(35,20%,78%)' }}>
          <TextField
            size="small"
            placeholder="Filter by name, location or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'hsl(0,0%,35%)' }} />
                </InputAdornment>
              ),
            }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.035)' } }}
          />
        </Box>

        {/* Header */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr 110px 130px 44px',
          gap: 2, px: 2.5, py: 1.5,
          borderBottom: '1px solid hsl(35,20%,78%)',
          bgcolor: 'rgba(0,0,0,0.035)',
        }}>
          {['Rank', 'Company', 'Score', 'Location', ''].map((h, i) => (
            <Typography key={i} variant="body2" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'hsl(0,0%,35%)', fontWeight: 600, fontSize: 15 }}>
              {h}
            </Typography>
          ))}
        </Box>

        {/* Skeleton rows */}
        {loading && [1, 2, 3, 4, 5].map((i) => (
          <Box key={i} sx={{
            display: 'grid', gridTemplateColumns: '80px 1fr 110px 130px 44px',
            gap: 2, px: 2.5, py: 2, borderBottom: '1px solid hsl(35,20%,78%)',
            alignItems: 'center', '&:last-child': { borderBottom: 0 },
          }}>
            <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />
            <Box>
              <Skeleton variant="text" width="60%" sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />
              <Skeleton variant="text" width="40%" sx={{ bgcolor: 'rgba(0,0,0,0.04)' }} />
            </Box>
            <Skeleton variant="rounded" width={60} height={24} sx={{ bgcolor: 'rgba(0,0,0,0.06)', borderRadius: '6px' }} />
            <Skeleton variant="text" width="70%" sx={{ bgcolor: 'rgba(0,0,0,0.04)' }} />
            <Skeleton variant="circular" width={28} height={28} sx={{ bgcolor: 'rgba(0,0,0,0.04)' }} />
          </Box>
        ))}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <EmptyState icon={TrophyIcon} title="No results" message={search ? 'Try a different search term.' : 'No businesses tracked yet.'} />
        )}

        {/* Rows */}
        {!loading && filtered.map((biz, i) => {
          const globalIndex = board.indexOf(biz);
          const bizKey = keys[globalIndex];
          const isFav = bizKey ? favourites.has(bizKey) : false;
          return (
            <Box
              key={bizKey ?? i}
              onClick={() => handleRowClick(biz)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 110px 130px 44px',
                gap: 2, px: 2.5, py: 2,
                borderBottom: '1px solid hsl(35,20%,78%)',
                alignItems: 'center',
                '&:last-child': { borderBottom: 0 },
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', cursor: 'pointer' },
                transition: 'background 0.15s',
              }}
            >
              <Box sx={{
                width: 32, height: 32, borderRadius: '50%', border: '1px solid',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 700, ...rankSx(globalIndex + 1),
              }}>
                {globalIndex + 1}
              </Box>

              <Box>
                <Typography variant="body1" fontWeight={600} sx={{ color: 'hsl(0,0%,12%)' }}>{biz.business_name}</Typography>
                <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)' }}>{biz.category}</Typography>
              </Box>

              <SentimentBadge score={biz.overall_score} size="md" />

              <Typography variant="body2" sx={{ color: 'hsl(0,0%,25%)' }}>{biz.location}</Typography>

              <Tooltip title={isFav ? 'Remove favourite' : 'Add to favourites'}>
                <span>
                  <IconButton
                    size="small"
                    disabled={!bizKey}
                    onClick={(e) => handleToggle(e, bizKey, biz.business_name, isFav)}
                    sx={{ color: isFav ? 'hsl(38,55%,48%)' : 'hsl(0,0%,35%)' }}
                  >
                    {isFav ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
