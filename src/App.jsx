import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
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
      <div className="app-bg" style={{
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse at 15% 20%, rgba(254, 249, 195, 0.35), transparent 45%),
          radial-gradient(ellipse at 85% 80%, rgba(253, 224, 71, 0.25), transparent 50%),
          radial-gradient(ellipse at 60% 10%, rgba(254, 240, 138, 0.3), transparent 40%),
          radial-gradient(ellipse at 40% 90%, rgba(253, 230, 138, 0.2), transparent 45%),
          linear-gradient(135deg, #A8B8A5, #B0BFA9 50%, #B5C4B1)
        `,
        backgroundAttachment: 'fixed',
      }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<EmailVerifyPage />} />
        <Route path="/profile/setup" element={<ProfileSetupPage />} />

        <Route path="/" element={<Navigate to="/gatherings" replace />} />
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
      </Routes>
      </div>
    </AuthProvider>
  )
}
