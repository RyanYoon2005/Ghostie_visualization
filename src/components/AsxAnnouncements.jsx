import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import Link from '@mui/material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PropTypes from 'prop-types';

const fadeUp = (delay = 0) => ({
  '@keyframes fadeUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to:   { opacity: 1, transform: 'translateY(0)' },
  },
  animation: `fadeUp 0.5s ease ${delay}s both`,
});

// Self-contained card that fetches ASX announcements for one business. Renders
// nothing if the company isn't ASX-listed (ticker null / total 0) — so it's
// safe to drop into any page without conditional gating.
export function AsxAnnouncements({ api, business, defaultExpanded = true, animationDelay = 0 }) {
  const hasBusiness = !!business?.business_name;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(hasBusiness);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (!business?.business_name) return;
    let cancelled = false;
    const params = new URLSearchParams({
      business_name: business.business_name,
      location: business.location ?? '',
      category: business.category ?? '',
    });
    api(`/asx/announcements?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [business?.business_name, business?.location, business?.category]);

  // Hide entirely when not ASX-listed, or while we're still figuring it out.
  if (loading) return null;
  if (!data || !data.ticker || !data.total) return null;

  const { ticker, total, market_sensitive_count: marketSensitive = 0, announcements = [] } = data;

  return (
    <Box sx={{
      ...fadeUp(animationDelay),
      borderRadius: '12px',
      border: '1px solid hsl(35,20%,78%)',
      bgcolor: 'hsl(40,35%,96%)',
      overflow: 'hidden',
    }}>
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{
          px: 2.5, py: 1.75,
          borderBottom: expanded ? '1px solid hsl(35,20%,78%)' : 'none',
          display: 'flex', alignItems: 'center', gap: 1.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.025)' },
          transition: 'background 0.15s',
        }}
      >
        <AccountBalanceIcon sx={{ fontSize: 22, color: 'hsl(210,50%,40%)' }} />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
              ASX Announcements
            </Typography>
            <Chip
              label={ticker}
              size="small"
              sx={{
                bgcolor: 'rgba(33,73,127,0.10)',
                border: '1px solid rgba(33,73,127,0.30)',
                color: 'hsl(210,50%,30%)',
                fontWeight: 700, height: 22, fontSize: 13,
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)' }}>
            {total} {total === 1 ? 'announcement' : 'announcements'}
            {marketSensitive > 0 && ` · ${marketSensitive} market-sensitive`}
          </Typography>
        </Box>
        <ExpandMoreIcon sx={{
          color: 'hsl(0,0%,45%)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }} />
      </Box>

      <Collapse in={expanded} timeout={250} unmountOnExit>
        {announcements.map((a, i) => (
          <Box
            key={`${a.released_at ?? i}-${i}`}
            sx={{
              px: 2.5, py: 1.75,
              borderBottom: i < announcements.length - 1 ? '1px solid hsl(35,20%,75%)' : 'none',
              display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' },
              transition: 'background 0.15s',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                {a.market_sensitive && (
                  <Chip
                    label="Market sensitive"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(180,80,60,0.14)',
                      border: '1px solid rgba(180,80,60,0.40)',
                      color: 'hsl(10,55%,32%)',
                      fontWeight: 700, height: 20, fontSize: 11, letterSpacing: 0.3,
                    }}
                  />
                )}
                <Typography variant="caption" sx={{ color: 'hsl(0,0%,40%)', fontSize: 14 }}>
                  {a.date}
                </Typography>
                {a.size && (
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,50%)', fontSize: 13 }}>
                    · {a.size}
                  </Typography>
                )}
                {a.pages != null && (
                  <Typography variant="caption" sx={{ color: 'hsl(0,0%,50%)', fontSize: 13 }}>
                    · {a.pages} {a.pages === 1 ? 'page' : 'pages'}
                  </Typography>
                )}
              </Box>
              <Link
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.5,
                  color: 'hsl(0,0%,15%)', fontWeight: 600, fontSize: 15,
                  lineHeight: 1.5,
                  '&:hover': { color: 'hsl(15,45%,38%)' },
                }}
              >
                {a.title}
                <OpenInNewIcon sx={{ fontSize: 15, color: 'hsl(0,0%,45%)' }} />
              </Link>
            </Box>
          </Box>
        ))}
      </Collapse>
    </Box>
  );
}

AsxAnnouncements.propTypes = {
  api: PropTypes.func.isRequired,
  business: PropTypes.shape({
    business_name: PropTypes.string,
    location: PropTypes.string,
    category: PropTypes.string,
  }),
  defaultExpanded: PropTypes.bool,
  animationDelay: PropTypes.number,
};
