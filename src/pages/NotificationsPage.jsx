import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIsMobile } from '../hooks/useIsMobile';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [notifications, setNotifications] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);

        // 알림 기본 데이터 조회
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // 관련 모임/유저 정보를 별도로 조회
        const enriched = await Promise.all((data || []).map(async (n) => {
          let gatherings = null;
          let related_user = null;

          if (n.gathering_id) {
            const { data: g } = await supabase
              .from('gatherings')
              .select('title')
              .eq('id', n.gathering_id)
              .maybeSingle();
            gatherings = g;
          }

          if (n.related_user_id) {
            const { data: u } = await supabase
              .from('profiles')
              .select('nickname')
              .eq('id', n.related_user_id)
              .maybeSingle();
            related_user = u;
          }

          return { ...n, gatherings, related_user };
        }));

        setNotifications(enriched);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [currentUser]);

  const markAsRead = async (notificationId) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
  };

  const handleNotificationClick = async (notification) => {
    let targetPath = null;

    if (notification.type === 'popularity_received') {
      targetPath = '/popularity';
    } else if (notification.gathering_id) {
      targetPath = `/gatherings/${notification.gathering_id}`;
    }

    await markAsRead(notification.id);
    setNotifications(prev => prev.filter(n => n.id !== notification.id));

    if (targetPath) {
      navigate(targetPath);
    }
  };

  const handleDeleteNotification = async (e, notificationId) => {
    e.stopPropagation();
    await markAsRead(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const getNotificationDisplay = (notification) => {
    const relatedUserNickname = notification.related_user?.nickname || '누군가';
    const gatheringTitle = notification.gatherings?.title || '모임';

    switch (notification.type) {
      case 'application_received':
        return {
          icon: '📩',
          message: `${relatedUserNickname}님이 "${gatheringTitle}" 모임에 지원했습니다.`,
          color: '#3b82f6'
        };
      case 'application_approved':
        return {
          icon: '✅',
          message: `"${gatheringTitle}" 모임 참가가 승인되었습니다!`,
          color: '#10b981'
        };
      case 'application_rejected':
        return {
          icon: '❌',
          message: `"${gatheringTitle}" 모임 참가가 거절되었습니다.`,
          color: '#ef4444'
        };
      case 'member_kicked':
        return {
          icon: '🚫',
          message: `"${gatheringTitle}" 모임에서 강제 퇴출되었습니다.`,
          color: '#ef4444'
        };
      case 'gathering_completed':
        return {
          icon: '✅',
          message: `"${gatheringTitle}" 모임이 완료되었습니다. 멤버를 평가해주세요!`,
          color: '#059669'
        };
      default:
        return {
          icon: '🔔',
          message: '새로운 알림이 있습니다.',
          color: '#6b7280'
        };
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now - notifTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return notifTime.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (!currentUser) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>로그인이 필요합니다.</p>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '10px 24px',
              backgroundColor: 'var(--button-primary)',
              color: 'white',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '12px 4px' : '32px 24px', ...(isMobile ? { width: '93%' } : {}) }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px', color: isMobile ? 'var(--text-primary)' : 'var(--button-primary)' }}>
        알림
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid var(--button-primary)',
            borderRadius: '50%',
            margin: '0 auto',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>알림을 불러오는 중...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔔</div>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)' }}>아직 알림이 없어요</p>
        </div>
      ) : (
        <div className="glass-strong" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          {notifications.map((notification, index) => {
            const display = getNotificationDisplay(notification);

            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  padding: '16px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: 'transparent',
                  borderBottom: index < notifications.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    fontSize: '20px',
                    flexShrink: 0,
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(107,144,128,0.2)'
                  }}>
                    {display.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: '14px',
                      lineHeight: '1.6',
                      marginBottom: '4px',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                      margin: '0 0 4px 0'
                    }}>
                      {display.message}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                      {formatTime(notification.created_at)}
                    </p>
                  </div>

                  <button
                    onClick={(e) => handleDeleteNotification(e, notification.id)}
                    style={{
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      fontSize: '16px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
