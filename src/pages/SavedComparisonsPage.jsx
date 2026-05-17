import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { makeApiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState } from '../components/EmptyState';

// Same colour slots as Premium Analysis so chips here match what the user will see
// once they load the comparison.
const SERIES_COLORS = [
  'hsl(95, 35%, 38%)',
  'hsl(20, 65%, 48%)',
  'hsl(210, 50%, 40%)',
  'hsl(42, 75%, 45%)',
  'hsl(280, 35%, 45%)',
];

const fadeUp = (delay = 0) => ({
  '@keyframes fadeUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to:   { opacity: 1, transform: 'translateY(0)' },
  },
  animation: `fadeUp 0.5s ease ${delay}s both`,
});

export default function SavedComparisonsPage() {
  const { token } = useAuth();
  const api = makeApiClient(token);
  const navigate = useNavigate();

  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api('/users/me/comparisons')
      .then((r) => (r.ok ? r.json() : { comparisons: [] }))
      .then((data) => setComparisons(data.comparisons ?? []))
      .catch(() => setError('Could not load your saved comparisons.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLoad = (cmp) => {
    // Hand the loaded comparison straight to Premium Analysis via navigation state —
    // no extra API round-trip needed since we already have the businesses array here.
    navigate('/history', {
      state: { comparisonBusinesses: cmp.businesses, comparisonName: cmp.name },
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this saved comparison?')) return;
    const prev = comparisons;
    setComparisons((cur) => cur.filter((c) => c.comparison_id !== id));
    try {
      const res = await api(`/users/me/comparisons/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    } catch {
      setComparisons(prev);
      setError('Could not delete comparison.');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ ...fadeUp(0), display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
            Saved Comparisons
          </Typography>
          <Typography variant="body2" sx={{ color: 'hsl(0,0%,35%)', mt: 0.5 }}>
            Your bookmarked head-to-head comparisons. Open one to render it on Premium Analysis.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<OpenInNewIcon />}
          onClick={() => navigate('/history')}
        >
          New comparison
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: 'hsl(15,45%,42%)' }} />
        </Box>
      ) : comparisons.length === 0 ? (
        <Box sx={{
          ...fadeUp(0.07),
          borderRadius: '14px',
          border: '1px solid hsl(35,20%,78%)',
          bgcolor: 'hsl(40,35%,96%)',
        }}>
          <EmptyState
            icon={BookmarkIcon}
            title="No saved comparisons yet"
            message="Build a comparison on Premium Analysis and hit Save to bookmark it here."
          />
        </Box>
      ) : (
        <Box sx={{
          ...fadeUp(0.07),
          borderRadius: '14px',
          border: '1px solid hsl(35,20%,78%)',
          bgcolor: 'hsl(40,35%,96%)',
          overflow: 'hidden',
        }}>
          {comparisons.map((cmp) => {
            const createdLabel = new Date(cmp.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
            return (
              <Box key={cmp.comparison_id} sx={{
                px: 2.5, py: 2,
                borderBottom: '1px solid hsl(35,20%,78%)',
                '&:last-child': { borderBottom: 'none' },
                display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.025)' },
                transition: 'background 0.15s',
              }}>
                <Box sx={{ flex: 1, minWidth: 240 }}>
                  <Typography variant="body1" fontWeight={600} sx={{ color: 'hsl(0,0%,12%)' }}>
                    {cmp.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', display: 'block', mb: 0.75 }}>
                    Saved {createdLabel} · {cmp.businesses.length} {cmp.businesses.length === 1 ? 'business' : 'businesses'}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {cmp.businesses.map((b, i) => {
                      const color = SERIES_COLORS[i % SERIES_COLORS.length];
                      return (
                        <Chip
                          key={`${b.business_name}-${i}`}
                          label={`${b.business_name}${b.location ? ` · ${b.location}` : ''}`}
                          size="small"
                          sx={{
                            bgcolor: `${color}22`,
                            border: `1px solid ${color}55`,
                            color, fontWeight: 600, height: 24, fontSize: 13,
                          }}
                        />
                      );
                    })}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleLoad(cmp)}
                  >
                    Open
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(cmp.comparison_id)}
                    sx={{ color: 'hsl(10,50%,38%)' }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
