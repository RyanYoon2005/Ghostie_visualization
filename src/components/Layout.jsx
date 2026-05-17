import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Divider, { dividerClasses } from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MuiMenuItem from '@mui/material/MenuItem';
import { paperClasses } from '@mui/material/Paper';
import { listClasses } from '@mui/material/List';
import { listItemIconClasses } from '@mui/material/ListItemIcon';
import MenuIcon from '@mui/icons-material/Menu';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import StarIcon from '@mui/icons-material/Star';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../auth/AuthContext';

const DRAWER_WIDTH = 260;

// Sidebar is split into two groups — a heading separates standard and premium features.
const navGroups = [
  {
    items: [
      { label: 'Dashboard',         icon: <DashboardIcon />,   path: '/' },
      { label: 'Standard Analysis', icon: <AnalyticsIcon />,   path: '/sentiment' },
      { label: 'Leaderboard',       icon: <LeaderboardIcon />, path: '/leaderboard' },
    ],
  },
  {
    title: 'Premium features',
    items: [
      { label: 'Premium Analysis',    icon: <CompareArrowsIcon />, path: '/history' },
      { label: 'Saved Comparisons',   icon: <BookmarkIcon />,      path: '/comparisons' },
      { label: 'Favourites',          icon: <StarIcon />,          path: '/favourites' },
    ],
  },
];

const MenuItem = styled(MuiMenuItem)({ margin: '2px 0' });

function OptionsMenu({ onLogout, onAddAccount }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const { accounts, user, switchAccount } = useAuth();
  const open = Boolean(anchorEl);
  const close = () => setAnchorEl(null);

  const otherAccounts = accounts.filter((a) => a.user.email !== user?.email);

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ borderColor: 'transparent' }}
      >
        <MoreVertRoundedIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        sx={{
          [`& .${listClasses.root}`]: { padding: '4px' },
          [`& .${paperClasses.root}`]: { padding: 0, minWidth: 200 },
          [`& .${dividerClasses.root}`]: { margin: '4px -4px' },
        }}
      >
        {/* Current account */}
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: 15, mr: 1 }}>
            {user?.username?.[0]?.toUpperCase()}
          </Avatar>
          <ListItemText
            primary={user?.username}
            secondary={user?.email}
            slotProps={{ primary: { fontSize: 16, fontWeight: 600 }, secondary: { fontSize: 14 } }}
          />
          <ListItemIcon sx={{ ml: 1, minWidth: 0 }}>
            <CheckRoundedIcon fontSize="small" color="primary" />
          </ListItemIcon>
        </MenuItem>

        {/* Other saved accounts */}
        {otherAccounts.length > 0 && <Divider />}
        {otherAccounts.map((a) => (
          <MenuItem key={a.user.email} onClick={() => { switchAccount(a.user.email); close(); }}>
            <Avatar sx={{ width: 24, height: 24, bgcolor: 'text.secondary', fontSize: 15, mr: 1 }}>
              {a.user.username?.[0]?.toUpperCase()}
            </Avatar>
            <ListItemText
              primary={a.user.username}
              secondary={a.user.email}
              slotProps={{ primary: { fontSize: 16 }, secondary: { fontSize: 14 } }}
            />
          </MenuItem>
        ))}

        <Divider />
        <MenuItem onClick={() => { onAddAccount(); close(); }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <AddRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText slotProps={{ primary: { fontSize: 16 } }}>Add another account</ListItemText>
        </MenuItem>

        <Divider />
        <MenuItem
          onClick={() => { onLogout(); close(); }}
          sx={{ [`& .${listItemIconClasses.root}`]: { ml: 'auto', minWidth: 0 } }}
        >
          <ListItemText slotProps={{ primary: { fontSize: 16 } }}>Logout</ListItemText>
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
        </MenuItem>
      </Menu>
    </>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  const handleAddAccount = () => {
    navigate('/signin', { state: { addAccount: true } });
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: '64px' }}>
      <Box sx={{ mt: 2, flex: 1 }}>
        <Box sx={{ px: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ flexShrink: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C7.03 2 3 6.03 3 11v9l3-3 3 3 3-3 3 3 3-3v-9c0-4.97-4.03-9-9-9z" fill="url(#ghost-grad)"/>
              <circle cx="9" cy="11" r="1.5" fill="hsl(40,30%,88%)"/>
              <circle cx="15" cy="11" r="1.5" fill="hsl(40,30%,88%)"/>
              <defs>
                <linearGradient id="ghost-grad" x1="3" y1="2" x2="21" y2="20" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="hsl(15,45%,45%)"/>
                  <stop offset="100%" stopColor="hsl(35,45%,45%)"/>
                </linearGradient>
              </defs>
            </svg>
          </Box>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'hsl(0,0%,12%)', lineHeight: 1.2, fontFamily: '"Sora", sans-serif' }}>
              Ghostie
            </Typography>
            <Typography variant="caption" sx={{ color: 'hsl(0,0%,35%)', fontSize: 13 }}>
              Sentiment Analyzer
            </Typography>
          </Box>
        </Box>
        <List>
          {navGroups.map((group, gIdx) => (
            <Box key={gIdx}>
              {group.title && (
                <Box sx={{
                  mt: gIdx === 0 ? 0 : 2,
                  mb: 0.5, mx: 2,
                  borderTop: '1px solid hsl(35,20%,75%)',
                  pt: 1.5,
                }}>
                  <Typography variant="caption" sx={{
                    color: 'hsl(15,45%,38%)',
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                    fontWeight: 700,
                    fontSize: 12,
                  }}>
                    {group.title}
                  </Typography>
                </Box>
              )}
              {group.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <ListItem key={item.path} disablePadding>
                    <ListItemButton
                      selected={active}
                      onClick={() => { navigate(item.path); setMobileOpen(false); }}
                      sx={{
                        borderRadius: 2, mx: 1, mb: 0.5,
                        color: active ? 'hsl(15,45%,38%)' : 'hsl(0,0%,30%)',
                        bgcolor: active ? 'rgba(160,90,60,0.10) !important' : 'transparent',
                        boxShadow: 'none',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', color: 'hsl(0,0%,12%)' },
                        transition: 'all 0.15s',
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{item.icon}</ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        slotProps={{ primary: { fontSize: 17, fontWeight: active ? 600 : 400 } }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </Box>
          ))}
        </List>
      </Box>

      <Stack
        direction="row"
        sx={{
          p: 2,
          gap: 1,
          alignItems: 'center',
          borderTop: '1px solid hsl(35, 20%, 72%)',
        }}
      >
        <Avatar
          sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 19 }}
        >
          {user?.username?.[0]?.toUpperCase() ?? '?'}
        </Avatar>
        <Box sx={{ mr: 'auto', overflow: 'hidden' }}>
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: '16px' }} noWrap>
            {user?.username ?? ''}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {user?.email ?? ''}
          </Typography>
        </Box>
        <OptionsMenu onLogout={handleLogout} onAddAccount={handleAddAccount} />
      </Stack>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'hsl(40, 30%, 92%)' }}>
      <AppBar position="fixed" elevation={0} sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        borderBottom: '1px solid hsl(35, 20%, 72%)',
        bgcolor: 'hsl(40, 35%, 96%)',
        backdropFilter: 'blur(16px)',
        color: 'hsl(0,0%,12%)',
        left: 0,
        right: 0,
        width: '100%',
      }}>
        <Toolbar>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1, color: 'hsl(0,0%,12%)' }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1, fontFamily: '"Sora", sans-serif', color: 'hsl(0,0%,12%)' }}>
            Ghostie Business Intelligence
          </Typography>
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: 'hsl(40, 25%, 86%)', borderRight: '1px solid hsl(35, 20%, 72%)' } }}>
          {drawer}
        </Drawer>
      ) : (
        <Drawer variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              bgcolor: 'hsl(40, 25%, 86%)',
              borderRight: '1px solid hsl(35, 20%, 72%)',
              top: 0,
              height: '100vh',
            },
          }}>
          {drawer}
        </Drawer>
      )}

      {/* Permanent drawer already takes DRAWER_WIDTH in the flex row — main just
          needs flexGrow:1 to fill the rest. minWidth:0 lets it shrink correctly
          if a child has a wide intrinsic size (e.g. the dashboard marquee). */}
      <Box component="main" sx={{
        flexGrow: 1,
        minWidth: 0,
        mt: '64px',
        p: 3,
        bgcolor: 'hsl(40, 30%, 92%)',
        minHeight: 'calc(100vh - 64px)',
      }}>
        {children}
      </Box>
    </Box>
  );
}
