import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import StarIcon from '@mui/icons-material/Star';
import BusinessIcon from '@mui/icons-material/Business';
import { SentimentBadge } from '../components/SentimentBadge';
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

const GLASS = {
  borderRadius: '12px',
  border: '1px solid hsl(35,20%,78%)',
  bgcolor: 'hsl(40,35%,96%)',
  overflow: 'hidden',
};

const fadeUp = (delay = 0) => ({
  '@keyframes fadeUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to:   { opacity: 1, transform: 'translateY(0)' },
  },
  animation: `fadeUp 0.5s ease ${delay}s both`,
});

export default function FavouritesPage() {
  const { token } = useAuth();
  const api = makeApiClient(token);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setSentimentBusiness } = useBusiness();
  const { favourites, toggle } = useFavourites(api);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api('/data-retrieval/companies').then((r) => r.json()),
      api('/analytical-model/leaderboard').then((r) => r.json()),
    ])
      .then(async ([data, lb]) => {
        const all = data.companies ?? [];
        const board = lb.leaderboard ?? [];
        // Build a score lookup by business key from the leaderboard
        const scoreMap = new Map();
        await Promise.all(board.map(async (b) => {
          const k = await computeKey(b.business_name, b.location, b.category);
          scoreMap.set(k, b.overall_score);
        }));
        const withKeys = await Promise.all(
          all.map(async (c) => {
            const key = await computeKey(c.business_name, c.location, c.category);
            return { ...c, computedKey: key, overall_score: scoreMap.get(key) ?? c.overall_score ?? null };
          })
        );
        setCompanies(withKeys);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const favourited = companies.filter((c) => favourites.has(c.computedKey));

  const handleRemove = (c) => {
    toggle(c.computedKey);
    showToast(`Removed ${c.business_name} from favourites`, 'info');
  };

  const handleRowClick = (c) => {
    setSentimentBusiness({ business_name: c.business_name, location: c.location, category: c.category });
    navigate('/sentiment');
  };

  return (
    <Box>
      <Box sx={{ mb: 3, ...fadeUp(0) }}>
        <Typography variant="h4" fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
          Favourites
        </Typography>
        <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)', mt: 0.5 }}>
          Your starred businesses. Click a row to run a Standard Analysis.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ ...GLASS, ...fadeUp(0.08) }}>
        {/* Header */}
        <Box sx={{
          display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 44px',
          gap: 2, px: 2.5, py: 1.5,
          borderBottom: '1px solid hsl(35,20%,78%)',
          bgcolor: 'rgba(0,0,0,0.035)',
        }}>
          {['', 'Company', 'Location', 'Score', ''].map((h, i) => (
            <Typography key={i} variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'hsl(0,0%,35%)', fontWeight: 600 }}>
              {h}
            </Typography>
          ))}
        </Box>

        {/* Skeleton rows */}
        {loading && [1, 2, 3].map((i) => (
          <Box key={i} sx={{
            display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 44px',
            gap: 2, px: 2.5, py: 2, alignItems: 'center',
            borderBottom: '1px solid hsl(35,20%,78%)', '&:last-child': { borderBottom: 0 },
          }}>
            <Skeleton variant="rounded" width={36} height={36} sx={{ bgcolor: 'rgba(0,0,0,0.06)', borderRadius: '8px' }} />
            <Box>
              <Skeleton variant="text" width="55%" sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />
              <Skeleton variant="text" width="35%" sx={{ bgcolor: 'rgba(0,0,0,0.04)' }} />
            </Box>
            <Skeleton variant="text" width="70%" sx={{ bgcolor: 'rgba(0,0,0,0.04)' }} />
            <Skeleton variant="rounded" width={60} height={24} sx={{ bgcolor: 'rgba(0,0,0,0.06)', borderRadius: '6px' }} />
            <Skeleton variant="circular" width={28} height={28} sx={{ bgcolor: 'rgba(0,0,0,0.04)' }} />
          </Box>
        ))}

        {/* Empty state */}
        {!loading && favourited.length === 0 && (
          <EmptyState
            icon={StarIcon}
            title="No favourites yet"
            message="Star a business on the Leaderboard or after a Standard Analysis."
          />
        )}

        {/* Rows */}
        {!loading && favourited.map((c) => (
          <Box
            key={c.computedKey}
            onClick={() => handleRowClick(c)}
            sx={{
              display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 44px',
              gap: 2, px: 2.5, py: 2, alignItems: 'center',
              borderBottom: '1px solid hsl(35,20%,78%)',
              '&:last-child': { borderBottom: 0 },
              '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', cursor: 'pointer' },
              transition: 'background 0.15s',
            }}
          >
            <Box sx={{
              width: 36, height: 36, borderRadius: '8px',
              bgcolor: 'rgba(120,135,90,0.12)', border: '1px solid rgba(120,135,90,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BusinessIcon sx={{ fontSize: 18, color: 'hsl(95,25%,42%)' }} />
            </Box>

            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ color: 'hsl(0,0%,12%)' }}>
                {c.business_name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'hsl(0,0%,35%)' }}>
                {c.category}
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)' }}>
              {c.location}
            </Typography>

            {c.overall_score != null
              ? <SentimentBadge score={c.overall_score} size="md" />
              : <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)' }}>—</Typography>
            }

            <Tooltip title="Remove favourite">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); handleRemove(c); }}
                sx={{ color: 'hsl(38,55%,48%)' }}
              >
                <StarIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
