import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppTheme from './shared-theme/AppTheme.jsx';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { BusinessProvider } from './context/BusinessContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import SentimentPage from './pages/SentimentPage';
import LeaderboardPage from './pages/LeaderboardPage';
import HistoryPage from './pages/HistoryPage';
import FavouritesPage from './pages/FavouritesPage';
import ScoreCardPage from './pages/ScoreCardPage';
import ComparePage from './pages/ComparePage';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (isAuthenticated && !location.state?.addAccount) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AppTheme>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/score/:name" element={<ScoreCardPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/signin" element={<GuestRoute><SignInPage /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><SignUpPage /></GuestRoute>} />
            <Route path="/*" element={
              <ProtectedRoute>
                <BusinessProvider>
                  <ToastProvider>
                    <Layout>
                      <Routes>
                        <Route path="/"            element={<DashboardPage />} />
                        <Route path="/sentiment"   element={<SentimentPage />} />
                        <Route path="/leaderboard" element={<LeaderboardPage />} />
                        <Route path="/history"     element={<HistoryPage />} />
                        <Route path="/favourites"  element={<FavouritesPage />} />
                      </Routes>
                    </Layout>
                  </ToastProvider>
                </BusinessProvider>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </AppTheme>
  );
}
