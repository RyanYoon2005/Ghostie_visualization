import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export function EmptyState({ icon: Icon, title, message }) {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', py: 10, gap: 2,
    }}>
      <Box sx={{
        width: 72, height: 72, borderRadius: '16px',
        bgcolor: 'rgba(0,0,0,0.04)', border: '1px solid hsl(35,20%,78%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon sx={{ fontSize: 36, color: 'hsl(0,0%,47%)' }} />
      </Box>
      {title && (
        <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'hsl(0,0%,20%)', fontFamily: '"Sora", sans-serif' }}>
          {title}
        </Typography>
      )}
      {message && (
        <Typography variant="body2" sx={{ color: 'hsl(0,0%,40%)', textAlign: 'center', maxWidth: 320 }}>
          {message}
        </Typography>
      )}
    </Box>
  );
}
