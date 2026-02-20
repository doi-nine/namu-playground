import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const GUEST_ALLOWED_PREFIXES = ['/gatherings'];

export default function AuthGate({ children }) {
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading, isGuest } = useAuth();

  const isGuestActive = isGuest || sessionStorage.getItem('guestMode') === 'true';
  const isGuestAllowed = isGuestActive && GUEST_ALLOWED_PREFIXES.some(
    prefix => location.pathname === prefix || location.pathname.startsWith(prefix + '/')
  );

  useEffect(() => {
    if (isGuestAllowed) { setChecking(false); return; }
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }
    if (!profile) { navigate("/profile/setup"); return; }
    setChecking(false);
  }, [authLoading, user, profile, navigate, isGuestAllowed]);

  if (isGuestAllowed) return children;

  if (authLoading || checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid var(--button-primary)',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto'
          }} />
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  return children;
}
