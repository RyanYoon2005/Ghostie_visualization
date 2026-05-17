import Box from '@mui/material/Box';

export function SentimentBadge({ score, size = 'md' }) {
  // positive >= 57.5, neutral >= 42.5, negative < 42.5
  const palette =
    score >= 57.5
      ? { bg: 'hsl(95 25% 42% / 0.12)', border: 'hsl(95 25% 42% / 0.30)', text: 'hsl(95,25%,32%)' }
      : score >= 42.5
      ? { bg: 'hsl(38 55% 48% / 0.12)', border: 'hsl(38 55% 48% / 0.30)', text: 'hsl(38,55%,32%)' }
      : { bg: 'hsl(10 50% 45% / 0.12)', border: 'hsl(10 50% 45% / 0.30)', text: 'hsl(10,50%,32%)' };

  const sizes = {
    sm: { fontSize: 14, px: 1,   py: 0.25, minWidth: 36 },
    md: { fontSize: 16, px: 1.5, py: 0.5,  minWidth: 44 },
    lg: { fontSize: 18, px: 2,   py: 0.75, minWidth: 54, fontWeight: 700 },
  }[size];

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 99,
        border: '1px solid',
        borderColor: palette.border,
        bgcolor: palette.bg,
        color: palette.text,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        ...sizes,
      }}
    >
      {score}
    </Box>
  );
}
