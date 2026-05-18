import { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import SentimentSatisfiedAltRoundedIcon from '@mui/icons-material/SentimentSatisfiedAltRounded';
import { useAuth } from '../auth/AuthContext';

const features = [
  {
    icon: <SentimentSatisfiedAltRoundedIcon sx={{ color: 'text.secondary' }} />,
    title: 'Business Sentiment Analysis',
    description: 'Understand public perception of any business using reviews and news — powered by ML.',
  },
  {
    icon: <TrendingUpRoundedIcon sx={{ color: 'text.secondary' }} />,
    title: 'Historical Tracking',
    description: "See how a business's sentiment score has changed over time and spot trends early.",
  },
  {
    icon: <LeaderboardRoundedIcon sx={{ color: 'text.secondary' }} />,
    title: 'Industry Leaderboard',
    description: 'Compare businesses side by side and discover who leads in public sentiment.',
  },
  {
    icon: <InsightsRoundedIcon sx={{ color: 'text.secondary' }} />,
    title: 'Data-Driven Insights',
    description: 'Top keywords, source breakdowns, and per-review scores give you the full picture.',
  },
];

const PageStack = styled(Stack)(({ theme }) => ({
  minHeight: '100dvh',
  '&::before': {
    content: '""',
    display: 'block',
    position: 'absolute',
    zIndex: -1,
    inset: 0,
    backgroundImage: 'radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))',
    backgroundRepeat: 'no-repeat',
    ...theme.applyStyles('dark', {
      backgroundImage: 'radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.5), hsl(220, 30%, 5%))',
    }),
  },
}));

const FormCard = styled(Card)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'center',
  width: '100%',
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  boxShadow:
    'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
  [theme.breakpoints.up('sm')]: { width: 450 },
  ...theme.applyStyles('dark', {
    boxShadow:
      'hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px',
  }),
}));

export default function SignInPage() {
  const { login, sessionExpired, clearSessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const addAccount = location.state?.addAccount ?? false;
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email address.';
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageStack direction="column" sx={{ justifyContent: 'center', p: 2 }}>
      <Stack
        direction={{ xs: 'column-reverse', md: 'row' }}
        sx={{
          justifyContent: 'center',
          alignItems: 'center',
          gap: { xs: 6, sm: 12 },
          p: { xs: 2, sm: 4 },
          m: 'auto',
        }}
      >
        {/* Left — feature content panel */}
        <Stack sx={{ flexDirection: 'column', alignSelf: 'center', gap: 4, maxWidth: 450 }}>
          <Typography variant="h4" fontWeight={700} sx={{ display: { xs: 'none', md: 'block' } }}>
            Ghostie
          </Typography>
          {features.map((item) => (
            <Stack key={item.title} direction="row" sx={{ gap: 2 }}>
              {item.icon}
              <Box>
                <Typography gutterBottom sx={{ fontWeight: 'medium' }}>{item.title}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{item.description}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>

        {/* Right — sign-in card */}
        <FormCard variant="outlined">
          <Typography variant="h4" fontWeight={700} sx={{ display: { xs: 'block', md: 'none' } }}>
            Ghostie
          </Typography>
          <Typography component="h1" variant="h4" sx={{ fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}>
            Sign in
          </Typography>

          {sessionExpired && !apiError && (
            <Alert severity="warning" onClose={clearSessionExpired}>
              Your session has expired. Please log in again to continue.
            </Alert>
          )}

          {apiError && <Alert severity="error">{apiError}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl>
              <FormLabel htmlFor="email">Email</FormLabel>
              <TextField
                id="email"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                autoFocus
                required
                fullWidth
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={!!errors.email}
                helperText={errors.email}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="password">Password</FormLabel>
              <TextField
                id="password"
                type="password"
                placeholder="••••••"
                autoComplete="current-password"
                required
                fullWidth
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                error={!!errors.password}
                helperText={errors.password}
              />
            </FormControl>
            <Button type="submit" fullWidth variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Sign in'}
            </Button>
          </Box>

          <Divider />

          <Typography sx={{ textAlign: 'center' }} variant="body2">
            Don&apos;t have an account?{' '}
            <RouterLink to="/signup" state={{ addAccount }} style={{ color: 'inherit', fontWeight: 500 }}>
              Sign up
            </RouterLink>
          </Typography>
        </FormCard>
      </Stack>
    </PageStack>
  );
}
