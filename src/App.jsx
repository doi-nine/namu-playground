import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { BookmarkProvider } from './context/BookmarkContext'
import { ToastProvider } from './components/Toast'
import LoginPage from './pages/LoginPage'
import ProfileSetupPage from './pages/ProfileSetupPage'
import MyPage from './pages/MyPage'
import AuthGate from './components/AuthGate'
import Layout from './components/Layout'
import CreateGatheringPage from './pages/CreateGatheringPage'
import GatheringDetailPage from './pages/GatheringDetailPage'
import GatheringListPage from './pages/GatheringListPage'
import ManageGatheringPage from './pages/ManageGatheringPage'
import CreateSchedulePage from './pages/CreateSchedulePage'
import ScheduleDetailPage from './pages/ScheduleDetailPage'
import MemberManagePage from './pages/MemberManagePage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage';
import ProfileEditPage from './pages/ProfileEditPage';
import AIRecommendPage from './pages/AIRecommendPage';
import PremiumPage from './pages/PremiumPage';
import PremiumSuccessPage from './pages/PremiumSuccessPage';
import PopularityPage from './pages/PopularityPage';
import UserProfilePage from './pages/UserProfilePage';
import EmailVerifyPage from './pages/EmailVerifyPage';
import SupportPage from './pages/SupportPage';
import BookmarksPage from './pages/BookmarksPage';
import GatheringHistoryPage from './pages/GatheringHistoryPage';
import UserHistoryPage from './pages/UserHistoryPage';
import LandingPage from './pages/LandingPage';

function AppLayout({ children }) {
  return (
    <AuthGate>
      <Layout>{children}</Layout>
    </AuthGate>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BookmarkProvider>
      <ToastProvider>
      <div className="app-bg" style={{
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse at 15% 20%, rgba(256, 251, 180, 0.35), transparent 45%),
          radial-gradient(ellipse at 85% 80%, rgba(255, 229, 51, 0.25), transparent 50%),
          radial-gradient(ellipse at 60% 10%, rgba(256, 242, 120, 0.3), transparent 40%),
          radial-gradient(ellipse at 40% 90%, rgba(255, 233, 120, 0.2), transparent 45%),
          linear-gradient(135deg, #97a899, #9fb0a3 50%, #a4b9a5)
        `,
      }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<EmailVerifyPage />} />
        <Route path="/profile/setup" element={<ProfileSetupPage />} />

        <Route path="/landing" element={<LandingPage />} />
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="/my/settings" element={<AppLayout><MyPage /></AppLayout>} />
        <Route path="/my-gatherings" element={<AppLayout><MyPage /></AppLayout>} />
        <Route path="/gathering/create" element={<AppLayout><CreateGatheringPage /></AppLayout>} />
        <Route path="/gatherings" element={<AppLayout><GatheringListPage /></AppLayout>} />
        <Route path="/gatherings/:id" element={<AppLayout><GatheringDetailPage /></AppLayout>} />
        <Route path="/gatherings/:id/manage" element={<AppLayout><ManageGatheringPage /></AppLayout>} />
        <Route path="/gatherings/:id/schedules/create" element={<AppLayout><CreateSchedulePage /></AppLayout>} />
        <Route path="/gatherings/:id/schedules/:scheduleId" element={<AppLayout><ScheduleDetailPage /></AppLayout>} />
        <Route path="/gatherings/:id/members" element={<AppLayout><MemberManagePage /></AppLayout>} />
        <Route path="/notifications" element={<AppLayout><NotificationsPage /></AppLayout>} />
        <Route path="/profile" element={<AppLayout><ProfilePage /></AppLayout>} />
        <Route path="/profile/edit" element={<AppLayout><ProfileEditPage /></AppLayout>} />
        <Route path="/ai-recommend" element={<AppLayout><AIRecommendPage /></AppLayout>} />
        <Route path="/popularity" element={<AppLayout><PopularityPage /></AppLayout>} />
        <Route path="/popularity/:userId" element={<AppLayout><PopularityPage /></AppLayout>} />
        <Route path="/premium" element={<AppLayout><PremiumPage /></AppLayout>} />
        <Route path="/premium/success" element={<AppLayout><PremiumSuccessPage /></AppLayout>} />
        <Route path="/users/:userId" element={<AppLayout><UserProfilePage /></AppLayout>} />
        <Route path="/support" element={<AppLayout><SupportPage /></AppLayout>} />
        <Route path="/my/bookmarks" element={<AppLayout><BookmarksPage /></AppLayout>} />
        <Route path="/my/history" element={<AppLayout><GatheringHistoryPage /></AppLayout>} />
        <Route path="/users/:userId/history" element={<AppLayout><UserHistoryPage /></AppLayout>} />
      </Routes>
      </div>
      </ToastProvider>
      </BookmarkProvider>
    </AuthProvider>
  )
}
