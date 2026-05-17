import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

const glowSx = {
  green:  { boxShadow: '0 0 20px hsl(95 25% 42% / 0.14), 0 0 60px hsl(95 25% 42% / 0.05)' },
  purple: { boxShadow: '0 0 20px hsl(35 50% 50% / 0.14), 0 0 60px hsl(35 50% 50% / 0.05)' },
};

function useCountUp(target, duration = 700) {
  const [animated, setAnimated] = useState(typeof target === 'number' ? target : 0);
  const prev = useRef(target);

  useEffect(() => {
    if (typeof target !== 'number') return;
    const from = typeof prev.current === 'number' ? prev.current : 0;
    prev.current = target;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = from + (target - from) * eased;
      setAnimated(Number.isInteger(target) ? Math.round(current) : Math.round(current * 10) / 10);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  // Non-numbers (strings, etc.) are returned directly without animation
  return typeof target !== 'number' ? target : animated;
}

export function StatsCard({ label, value, icon: Icon, trend, glow }) {
  const animated = useCountUp(value);

  return (
    <Box sx={{
      p: 2.5,
      borderRadius: '12px',
      border: '1px solid hsl(35,20%,78%)',
      bgcolor: 'hsl(40,35%,96%)',
      backdropFilter: 'blur(16px)',
      transition: 'box-shadow 0.3s',
      ...(glow ? glowSx[glow] : {}),
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="caption" sx={{
            textTransform: 'uppercase', letterSpacing: 1.2,
            color: 'hsl(0,0%,35%)', display: 'block', mb: 0.5, fontSize: 15, fontWeight: 600,
          }}>
            {label}
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ color: 'hsl(0,0%,12%)', fontFamily: '"Sora", sans-serif' }}>
            {animated}
          </Typography>
          {trend && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, mt: 1,
              color: trend.positive ? 'hsl(95,25%,42%)' : 'hsl(10,50%,45%)',
            }}>
              {trend.positive
                ? <TrendingUpIcon sx={{ fontSize: 16 }} />
                : <TrendingDownIcon sx={{ fontSize: 16 }} />}
              <Typography variant="caption" fontWeight={600} sx={{ fontSize: 14 }}>
                {trend.positive ? '+' : ''}{trend.value}%
              </Typography>
            </Box>
          )}
        </Box>
        {Icon && (
          <Box sx={{
            width: 40, height: 40, borderRadius: 2,
            bgcolor: 'rgba(0,0,0,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon sx={{ fontSize: 20, color: 'hsl(0,0%,35%)' }} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
