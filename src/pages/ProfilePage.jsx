import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Star } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [popularityScore, setPopularityScore] = useState(0);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchPopularity();
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
        console.error('프로필 로드 실패:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('프로필 로드 예외:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPopularity() {
    try {
      const { data } = await supabase
        .from('popularity_scores')
        .select('total_score')
        .eq('user_id', user.id)
        .maybeSingle();

      setPopularityScore(data?.total_score || 0);
    } catch (error) {
      console.error('인기도 로드 오류:', error);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid var(--button-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  const innerCardStyle = {
    background: 'rgba(255,255,255,0.5)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '16px',
    padding: '24px',
  };

  const cardTitleStyle = {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    paddingBottom: '12px',
    marginBottom: '16px',
    borderBottom: '1px solid rgba(0,0,0,0.08)',
  };

  const bannerHeight = isMobile ? 150 : 300;
  const bannerInnerHeight = isMobile ? 100 : 276;
  const bannerTop = isMobile ? 130 : 250;
  const bannerLeft = isMobile ? 12 : 32;

  return (
    <div style={{ position: 'relative', paddingTop: `${bannerHeight}px` }}>
      {/* 배너 영역 - 투명 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: `${bannerInnerHeight}px`,
        background: 'transparent',
        borderRadius: '16px 16px 0 0',
      }} />

      {/* 닉네임 + 버튼 */}
      <div style={{
        position: 'absolute',
        top: `${bannerTop}px`,
        left: `${bannerLeft}px`,
        right: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 2,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        gap: isMobile ? '8px' : '0',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <h1 style={{
            fontSize: '26px',
            fontWeight: '700',
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            {profile?.nickname}
          </h1>
          {profile?.custom_badge && (
            <span style={{
              padding: '1px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '500',
              backgroundColor: 'rgba(107, 144, 128, 0.15)',
              color: 'var(--button-primary)',
              marginBottom: '7px',
            }}>
              {profile.custom_badge}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* 인기도 버튼 */}
          <button
            onClick={() => navigate('/popularity')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: '1.6px solid #6B9080',
              borderRadius: '10px',
              background: '#FFFFFF',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.85)'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
          >
            <Star size={18} color="#EAB308" fill="#EAB308" />
            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {popularityScore}
            </span>
          </button>
          {/* 수정 버튼 */}
          <button
            onClick={() => navigate('/profile/edit')}
            style={{
              padding: '8px 16px',
              border: '1.6px solid #6B9080',
              borderRadius: '10px',
              background: '#FFFFFF',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.85)'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
          >
            수정
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 - 2열 그리드 (모바일 1열) */}
      <div
        className={isMobile ? 'grid-mobile-col' : ''}
        style={{
          padding: isMobile ? '0 4px 8px' : '0 8px 8px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? '16px' : '24px',
        }}
      >
        {/* 왼쪽 열 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 취미 카드 - 200px */}
          <div style={{ ...innerCardStyle, minHeight: '200px' }}>
            <h3 style={cardTitleStyle}>취미</h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.8 }}>
              {profile?.recent_games ? (
                profile.recent_games.split(',').map((game, idx) => (
                  <p key={idx} style={{ margin: '0 0 4px 0' }}>• {game.trim()}</p>
                ))
              ) : profile?.favorite_game_title ? (
                <p style={{ margin: 0 }}>• {profile.favorite_game_title}</p>
              ) : null}
            </div>
          </div>

          {/* 좋아하는 것 카드 - 200px */}
          <div style={{ ...innerCardStyle, minHeight: '200px' }}>
            <h3 style={cardTitleStyle}>하고 싶은 것</h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.8 }}>
              {profile?.favorite_game_categories?.length > 0 ? (
                profile.favorite_game_categories.map((game, idx) => (
                  <p key={idx} style={{ margin: '0 0 4px 0' }}>• {game}</p>
                ))
              ) : (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>등록된 게임이 없습니다</p>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽 열 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          height: isMobile ? 'auto' : '424px',
        }}>
          {/* 자기소개 카드 - flexGrow로 남은 공간 차지 */}
          <div style={{
            ...innerCardStyle,
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '24px',
            overflow: 'hidden',
          }}>
            <h3 style={cardTitleStyle}>자기소개</h3>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              lineHeight: 1.8,
              wordBreak: 'break-word',
              paddingRight: '8px',
            }}>
              {(profile?.birth_year || profile?.age_range) && (
                <p style={{ margin: '0 0 6px 0' }}>나이: {profile.age_range || `${profile.birth_year}년생`}</p>
              )}
              {profile?.location && (
                <p style={{ margin: '0 0 6px 0' }}>지역: {profile.location}</p>
              )}
              {profile?.bio && (
                <p style={{ margin: '12px 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {profile.bio.substring(0, 500)}
                </p>
              )}
              {!profile?.bio && !profile?.birth_year && !profile?.age_range && !profile?.location && (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>작성된 자기소개가 없습니다</p>
              )}
            </div>
          </div>

          {/* 태그 - 하단 고정 (선호하는 게임 밑단과 동일선상) */}
          {profile?.favorite_game_categories?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
              {profile.favorite_game_categories.map((tag, idx) => (
                <button
                  key={idx}
                  onClick={() => navigate(`/gatherings?search=${encodeURIComponent(tag)}`)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '20px',
                    background: '#FFFFFF',
                    border: '2px solid #6B9080',
                    color: '#6B9080',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(107,144,128,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
