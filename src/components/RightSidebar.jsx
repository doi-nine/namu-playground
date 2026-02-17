import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function RightSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myGatherings, setMyGatherings] = useState([]);
  const [showMyGatherings, setShowMyGatherings] = useState(() => localStorage.getItem('showMyGatherings') === 'true');

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchUnreadCount();
      fetchMyGatherings();
    }
  }, [user]);

  async function fetchProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        console.error('프로필 조회 오류:', error);
        return;
      }
      setProfile(data);
    } catch (err) {
      console.error('프로필 조회 예외:', err);
    }
  }

  async function fetchUnreadCount() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
      setUnreadCount(data?.length || 0);
    } catch (err) {
      console.error('읽지 않은 알림 조회 오류:', err);
    }
  }

  async function fetchMyGatherings() {
    try {
      // 1단계: 내 멤버십 gathering_id 조회
      const { data: memberships, error: memberError } = await supabase
        .from('gathering_members')
        .select('gathering_id')
        .eq('user_id', user.id)
        .eq('status', 'approved');
      if (memberError) throw memberError;

      const gatheringIds = memberships?.map(m => m.gathering_id) || [];
      if (gatheringIds.length === 0) {
        setMyGatherings([]);
        return;
      }

      // 2단계: 모임 정보 조회
      const { data: gatherings, error: gatheringError } = await supabase
        .from('gatherings')
        .select('id, title')
        .in('id', gatheringIds);
      if (gatheringError) throw gatheringError;
      setMyGatherings(gatherings || []);
    } catch (err) {
      console.error('내 모임 조회 오류:', err);
    }
  }

  async function handleLogout() {
    const confirm = window.confirm('로그아웃 하시겠습니까?');
    if (!confirm) return;
    await supabase.auth.signOut();
    navigate('/login');
  }

  const isActive = (path) => location.pathname === path;

  const menuBtnStyle = (path) => ({
    width: '100%',
    textAlign: 'left',
    padding: '10px 16px',
    backgroundColor: isActive(path) ? '#C5D89D' : 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '4px',
    transition: 'background-color 0.2s',
    fontFamily: 'inherit'
  });

  const menuTextStyle = (path) => ({
    fontWeight: '600',
    fontSize: '14px',
    color: isActive(path) ? '#5A6B3F' : '#4A4A4A',
    letterSpacing: '-0.01em'
  });

  return (
    <div style={{
      width: '256px',
      backgroundColor: '#FFFFFF',
      position: 'fixed',
      right: 0,
      top: 0,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 20,
      borderLeft: '1px solid #E8E0C8'
    }}>
      {/* 상단: 알림 + 설정 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid #E8E0C8'
      }}>
        <button
          onClick={() => navigate('/notifications')}
          style={{
            position: 'relative',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '6px',
            borderRadius: '8px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F6F0D7'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span role="img" aria-label="알림">🔔</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              backgroundColor: '#C75050',
              color: 'white',
              fontSize: '10px',
              fontWeight: 'bold',
              padding: '1px 5px',
              borderRadius: '10px',
              minWidth: '16px',
              textAlign: 'center'
            }}>
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/settings')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '6px',
            borderRadius: '8px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F6F0D7'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span role="img" aria-label="설정">⚙️</span>
        </button>
      </div>

      {/* 중간: 메뉴 */}
      <div style={{
        flex: 1,
        padding: '12px',
        overflowY: 'auto'
      }}>
        {/* 내 프로필 */}
        <button
          onClick={() => navigate('/profile')}
          style={menuBtnStyle('/profile')}
          onMouseEnter={(e) => !isActive('/profile') && (e.currentTarget.style.backgroundColor = '#F6F0D7')}
          onMouseLeave={(e) => !isActive('/profile') && (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div style={{ ...menuTextStyle('/profile'), display: 'flex', alignItems: 'center', gap: '8px' }}>
            내 프로필
            {profile?.is_premium && <span style={{ fontSize: '14px' }}>👑</span>}
          </div>
          {profile && <div style={{ fontSize: '12px', color: '#89986D', marginTop: '2px' }}>{profile.nickname}</div>}
        </button>

        {/* 모임 찾기 */}
        <button
          onClick={() => navigate('/gatherings')}
          style={menuBtnStyle('/gatherings')}
          onMouseEnter={(e) => !isActive('/gatherings') && (e.currentTarget.style.backgroundColor = '#F6F0D7')}
          onMouseLeave={(e) => !isActive('/gatherings') && (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div style={menuTextStyle('/gatherings')}>모임찾기</div>
        </button>

        {/* 모임 만들기 */}
        <button
          onClick={() => navigate('/gathering/create')}
          style={menuBtnStyle('/gathering/create')}
          onMouseEnter={(e) => !isActive('/gathering/create') && (e.currentTarget.style.backgroundColor = '#F6F0D7')}
          onMouseLeave={(e) => !isActive('/gathering/create') && (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div style={menuTextStyle('/gathering/create')}>모임만들기</div>
        </button>

        {/* 내 모임 (폴더 토글) */}
        <button
          onClick={() => {
            const next = !showMyGatherings;
            setShowMyGatherings(next);
            localStorage.setItem('showMyGatherings', String(next));
          }}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '10px 16px',
            backgroundColor: showMyGatherings ? '#C5D89D' : 'transparent',
            border: 'none',
            borderRadius: showMyGatherings ? '8px 8px 0 0' : '8px',
            cursor: 'pointer',
            marginBottom: showMyGatherings ? 0 : '4px',
            transition: 'background-color 0.2s',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => !showMyGatherings && (e.currentTarget.style.backgroundColor = '#F6F0D7')}
          onMouseLeave={(e) => !showMyGatherings && (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div style={{
            fontWeight: '600',
            fontSize: '14px',
            color: showMyGatherings ? '#5A6B3F' : '#4A4A4A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>내 모임</span>
            <span style={{ fontSize: '10px', color: '#89986D' }}>{showMyGatherings ? '▲' : '▼'}</span>
          </div>
        </button>
        {showMyGatherings && (
          <div style={{
            backgroundColor: '#FAFAF2',
            borderRadius: '0 0 8px 8px',
            marginBottom: '4px',
            maxHeight: '240px',
            overflowY: 'auto',
            border: '1px solid #E8E0C8',
            borderTop: 'none'
          }}>
            {myGatherings.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: '12px', color: '#89986D', textAlign: 'center' }}>
                가입한 모임이 없습니다
              </div>
            ) : (
              myGatherings.map((gathering) => (
                <button
                  key={gathering.id}
                  onClick={() => navigate(`/gatherings/${gathering.id}`)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 16px 8px 24px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderTop: '1px solid #E8E0C8',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    fontFamily: 'inherit'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F6F0D7'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ fontSize: '13px', color: '#4A4A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {gathering.title}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 하단: 로그아웃 + 고객센터 */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid #E8E0C8'
      }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '10px 16px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            marginBottom: '4px',
            transition: 'background-color 0.2s',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FFF0F0'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div style={{ fontWeight: '600', fontSize: '14px', color: '#C75050' }}>로그아웃</div>
        </button>

        <button
          onClick={() => alert('고객센터는 준비 중입니다.')}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '10px 16px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F6F0D7'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div style={{ fontWeight: '600', fontSize: '14px', color: '#89986D' }}>고객센터</div>
        </button>
      </div>
    </div>
  );
}