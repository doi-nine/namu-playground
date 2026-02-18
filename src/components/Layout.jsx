import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Home, Search, Plus, List, User,
  Bell, LogOut, HelpCircle,
  ChevronRight, ChevronLeft, ChevronDown,
  Settings, Sparkles, Star
} from 'lucide-react';
import { useBookmarks } from '../context/BookmarkContext';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [myGatheringsOpen, setMyGatheringsOpen] = useState(false);
  const [myGatherings, setMyGatherings] = useState([]);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const { bookmarks } = useBookmarks();

  const handleSidebarToggle = () => {
    setIsTransitioning(true);
    setSidebarOpen(prev => !prev);
    setTimeout(() => setIsTransitioning(false), 350);
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchUnreadCount();
      fetchMyGatherings();
    }
  }, [user, location.pathname]);

  async function fetchProfile() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      setProfile(data);
    } catch (err) {
      console.error('프로필 조회 오류:', err);
    }
  }

  async function fetchUnreadCount() {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(data?.length || 0);
    } catch (err) {
      console.error('알림 조회 오류:', err);
    }
  }

  async function fetchMyGatherings() {
    try {
      const { data } = await supabase
        .from('gathering_members')
        .select('gathering_id, gatherings(id, title)')
        .eq('user_id', user.id);

      const gatherings = data?.map(m => m.gatherings).filter(Boolean) || [];
      // 중복 제거
      const unique = gatherings.filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i);
      setMyGatherings(unique);
    } catch (err) {
      console.error('모임 목록 조회 오류:', err);
    }
  }

  async function handleLogout() {
    if (!window.confirm('로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    navigate('/login');
  }

  const isActive = (path) => location.pathname === path;

  const sidebarWidth = sidebarOpen ? 280 : 72;

  const menuItems = [
    { path: '/profile', label: '내 프로필', icon: User },
    { path: '/gatherings', label: '모임 검색', icon: Search },
    { path: '/gathering/create', label: '모임 만들기', icon: Plus },
  ];

  const isMyGatheringsActive = location.pathname.startsWith('/my/') || location.pathname.startsWith('/gatherings/');

  const mobileTabItems = [
    { path: '/gatherings', label: '모임', icon: Search },
    { path: '/notifications', label: '알림', icon: Bell },
    { path: '/gathering/create', label: '만들기', icon: Plus },
    { path: '/my/settings', label: '내 모임', icon: List },
    { path: '/profile', label: '프로필', icon: User },
  ];

  // 모바일: 전체 뷰포트를 fixed로 잡고 내부만 스크롤
  if (isMobile) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1,
      }}>
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}>
          <div style={{ width: '95%', margin: '0 auto' }}>
            {children}
          </div>
        </div>

        {/* 탭바 */}
        <div
          className="bottom-tab-bar"
          onTouchMove={(e) => e.preventDefault()}
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '8px 0',
            background: '#FFFFFF',
            borderTop: '1px solid rgba(0,0,0,0.08)',
            touchAction: 'none',
          }}
        >
          {mobileTabItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path)
              || (item.path === '/my/settings' && location.pathname.startsWith('/my/'))
              || (item.path === '/gatherings' && location.pathname.startsWith('/gatherings'));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                }}
              >
                <Icon
                  size={22}
                  color={active ? 'var(--button-primary)' : 'var(--text-muted)'}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span style={{
                  fontSize: '10px',
                  fontWeight: active ? '600' : '400',
                  color: active ? 'var(--button-primary)' : 'var(--text-muted)',
                }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 데스크톱 레이아웃 (2-column: main + right sidebar)
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
    }}>
      {/* 메인 콘텐츠 영역 — 접힌 사이드바 기준 고정 */}
      <div style={{
        flex: 1,
        marginRight: `${72 + 16}px`,
        minHeight: '100vh',
        padding: '24px',
        paddingBottom: '120px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '750px',
          margin: '0 auto',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.3))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: '24px',
          padding: '40px 40px 16px 40px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}>
          {children}
        </div>
      </div>

      {/* 오른쪽 사이드바 */}
      <div style={{
        width: `${sidebarWidth}px`,
        height: 'calc(100vh - 24px)',
        position: 'fixed',
        right: 0,
        top: '24px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(255,255,255,0.2))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.4)',
        borderRadius: '24px 0 0 24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.7)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        transition: isTransitioning ? 'width 300ms ease-in-out' : 'none',
        overflow: 'hidden',
      }}>
        {/* 로고 + 아이콘 영역 */}
        <div style={{
          padding: sidebarOpen ? '20px 20px 16px' : '20px 0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          borderBottom: '1px solid rgba(255,255,255,0.3)',
        }}>
          {sidebarOpen && (
            <span style={{
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
            }}>
              나무 놀이터
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {sidebarOpen && (
              <button
                onClick={() => navigate('/notifications')}
                style={{
                  position: 'relative',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Bell size={20} color="var(--text-primary)" />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    backgroundColor: 'var(--danger)',
                    color: 'white',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    padding: '1px 4px',
                    borderRadius: '10px',
                    minWidth: '14px',
                    textAlign: 'center'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
            {/* 접기/펼치기 토글 버튼 */}
            <button
              onClick={handleSidebarToggle}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {sidebarOpen
                ? <ChevronRight size={20} color="var(--text-primary)" />
                : <ChevronLeft size={20} color="var(--text-primary)" />
              }
            </button>
          </div>
        </div>

        {/* 메뉴 항목들 */}
        <div style={{
          flex: 1,
          padding: '12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          overflowY: 'auto',
        }}>
          {menuItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: sidebarOpen ? '12px 16px' : '12px 0',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  background: active ? 'rgba(255,255,255,0.3)' : 'transparent',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  width: '100%',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon
                  size={20}
                  color={active ? 'var(--text-primary)' : 'var(--text-secondary)'}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {sidebarOpen && (
                  <span style={{
                    fontSize: '14px',
                    fontWeight: active ? '600' : '500',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    {item.path === '/profile' ? (
                      <>
                        {profile?.nickname || '내 프로필'}
                        {profile?.custom_badge && (
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500',
                            backgroundColor: 'rgba(107,144,128,0.15)',
                            color: 'var(--button-primary)',
                          }}>
                            {profile.custom_badge}
                          </span>
                        )}
                        {profile?.is_premium && <span style={{ fontSize: '12px' }}>👑</span>}
                      </>
                    ) : item.label}
                  </span>
                )}
              </button>
            );
          })}

          {/* 내 모임 드롭다운 */}
          <div>
            <button
              onClick={() => {
                if (sidebarOpen) {
                  setMyGatheringsOpen(prev => !prev);
                } else {
                  navigate('/my/settings');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: sidebarOpen ? '12px 16px' : '12px 0',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                background: isMyGatheringsActive ? 'rgba(255,255,255,0.3)' : 'transparent',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                if (!isMyGatheringsActive) e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              }}
              onMouseLeave={(e) => {
                if (!isMyGatheringsActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <List
                size={20}
                color={isMyGatheringsActive ? 'var(--text-primary)' : 'var(--text-secondary)'}
                strokeWidth={isMyGatheringsActive ? 2.2 : 1.8}
              />
              {sidebarOpen && (
                <>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: isMyGatheringsActive ? '600' : '500',
                    color: isMyGatheringsActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    textAlign: 'left',
                  }}>
                    내 모임
                  </span>
                  <Settings
                    size={16}
                    color={isActive('/my/settings') ? 'var(--text-primary)' : 'var(--text-muted)'}
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/my/settings');
                    }}
                  />
                  <ChevronDown
                    size={16}
                    color="var(--text-muted)"
                    style={{
                      transition: 'transform 0.2s',
                      transform: myGatheringsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      flexShrink: 0,
                    }}
                  />
                </>
              )}
            </button>

            {/* 드롭다운 하위 메뉴 */}
            {sidebarOpen && (
              <div style={{
                maxHeight: myGatheringsOpen ? `${myGatherings.length * 40 + 16}px` : '0px',
                overflow: 'hidden',
                transition: 'max-height 0.25s ease-in-out',
                paddingLeft: '16px',
                paddingRight: '4px',
              }}>
                <div style={{ paddingTop: '4px', paddingBottom: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {myGatherings.map(gathering => {
                    const gatheringPath = `/gatherings/${gathering.id}`;
                    const active = isActive(gatheringPath);
                    return (
                      <button
                        key={gathering.id}
                        onClick={() => navigate(gatheringPath)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          background: active ? 'rgba(255,255,255,0.3)' : 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          width: '100%',
                          fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => {
                          if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          if (!active) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: active ? 'var(--button-primary)' : 'var(--text-muted)',
                          flexShrink: 0,
                        }} />
                        <span style={{
                          fontSize: '13px',
                          fontWeight: active ? '500' : '400',
                          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {gathering.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 즐겨찾기 드롭다운 */}
          <div>
            <button
              onClick={() => {
                if (sidebarOpen) {
                  setBookmarksOpen(prev => !prev);
                } else {
                  navigate('/my/bookmarks');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: sidebarOpen ? '12px 16px' : '12px 0',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                background: isActive('/my/bookmarks') ? 'rgba(255,255,255,0.3)' : 'transparent',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                if (!isActive('/my/bookmarks')) e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              }}
              onMouseLeave={(e) => {
                if (!isActive('/my/bookmarks')) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Star
                size={20}
                color={isActive('/my/bookmarks') ? 'var(--text-primary)' : 'var(--text-secondary)'}
                strokeWidth={isActive('/my/bookmarks') ? 2.2 : 1.8}
              />
              {sidebarOpen && (
                <>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: isActive('/my/bookmarks') ? '600' : '500',
                    color: isActive('/my/bookmarks') ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    textAlign: 'left',
                  }}>
                    즐겨찾기
                  </span>
                  <ChevronDown
                    size={16}
                    color="var(--text-muted)"
                    style={{
                      transition: 'transform 0.2s',
                      transform: bookmarksOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      flexShrink: 0,
                    }}
                  />
                </>
              )}
            </button>

            {sidebarOpen && (
              <div style={{
                maxHeight: bookmarksOpen ? `${Math.max(bookmarks.length, 1) * 40 + 16}px` : '0px',
                overflow: 'hidden',
                transition: 'max-height 0.25s ease-in-out',
                paddingLeft: '16px',
                paddingRight: '4px',
              }}>
                <div style={{ paddingTop: '4px', paddingBottom: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {bookmarks.length === 0 ? (
                    <p style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      padding: '8px 12px',
                      margin: 0,
                    }}>
                      즐겨찾기한 모임이 없습니다
                    </p>
                  ) : (
                    bookmarks.map(gathering => {
                      const gatheringPath = `/gatherings/${gathering.id}`;
                      const active = isActive(gatheringPath);
                      return (
                        <button
                          key={gathering.id}
                          onClick={() => navigate(gatheringPath)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            background: active ? 'rgba(255,255,255,0.3)' : 'transparent',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            width: '100%',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => {
                            if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                          }}
                          onMouseLeave={(e) => {
                            if (!active) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: active ? 'var(--button-primary)' : 'var(--text-muted)',
                            flexShrink: 0,
                          }} />
                          <span style={{
                            fontSize: '13px',
                            fontWeight: active ? '500' : '400',
                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {gathering.title}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 하단: 업그레이드 + 로그아웃 + 고객센터 */}
        <div style={{
          padding: '12px 8px',
          borderTop: '1px solid rgba(255,255,255,0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {/* 무료 유저 전용 업그레이드 버튼 */}
          {profile && !profile.is_premium && (
            <button
              onClick={() => navigate('/premium')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: sidebarOpen ? '10px 16px' : '10px 0',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                background: 'linear-gradient(135deg, rgba(197,216,157,0.4), rgba(107,144,128,0.3))',
                border: '1px solid rgba(107,144,128,0.35)',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                fontFamily: 'inherit',
                marginBottom: '2px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(197,216,157,0.6), rgba(107,144,128,0.45))'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(197,216,157,0.4), rgba(107,144,128,0.3))'}
            >
              <Sparkles size={16} color="var(--button-primary)" />
              {sidebarOpen && (
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--button-primary)', whiteSpace: 'nowrap' }}>
                  요금제 업그레이드
                </span>
              )}
            </button>
          )}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: sidebarOpen ? '10px 16px' : '10px 0',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: '100%',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220,38,38,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut size={18} color="var(--danger)" />
            {sidebarOpen && (
              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--danger)', whiteSpace: 'nowrap' }}>
                로그아웃
              </span>
            )}
          </button>

          <button
            onClick={() => alert('고객센터는 준비 중입니다.')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: sidebarOpen ? '10px 16px' : '10px 0',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: '100%',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <HelpCircle size={18} color="var(--text-muted)" />
            {sidebarOpen && (
              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                고객센터
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
