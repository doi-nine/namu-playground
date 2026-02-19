import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Heart } from 'lucide-react';

export default function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { profile: myProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [popularityScore, setPopularityScore] = useState(0);

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchPopularity();
    }
  }, [userId]);

  async function fetchProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
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
        .eq('user_id', userId)
        .maybeSingle();

      setPopularityScore(data?.total_score || 0);
    } catch (error) {
      console.error('매너도 로드 오류:', error);
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

  if (!profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>프로필을 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 20px',
              backgroundColor: 'var(--button-primary)',
              color: 'white',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            뒤로 가기
          </button>
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

  return (
    <div style={{ position: 'relative', paddingTop: '300px' }}>
      {/* 배너 영역 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '276px',
        background: 'transparent',
        borderRadius: '16px 16px 0 0',
      }} />

      {/* 닉네임 + 매너도 */}
      <div style={{
        position: 'absolute',
        top: '250px',
        left: '32px',
        right: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 2,
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {profile?.is_premium && (
            <span style={{ fontSize: '20px' }}>👑</span>
          )}
          {myProfile?.is_premium && (
            <div
              onClick={() => navigate(`/popularity/${userId}`)}
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
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
            >
              <Heart size={18} color="#F43F5E" fill="#F43F5E" />
              <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                {popularityScore}
              </span>
            </div>
          )}
          <button
            onClick={() => navigate(`/users/${userId}/history`)}
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
            이력
          </button>
          <button
            onClick={() => navigate(-1)}
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
            뒤로
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 - 2열 그리드 */}
      <div style={{
        padding: '0 8px 8px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
      }}>
        {/* 왼쪽 열 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ ...innerCardStyle, minHeight: '200px' }}>
            <h3 style={cardTitleStyle}>취미</h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.8 }}>
              {profile?.recent_games ? (
                profile.recent_games.split(',').map((game, idx) => (
                  <p key={idx} style={{ margin: '0 0 4px 0' }}>• {game.trim()}</p>
                ))
              ) : profile?.favorite_game_title ? (
                <p style={{ margin: 0 }}>• {profile.favorite_game_title}</p>
              ) : (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>등록된 게임이 없습니다</p>
              )}
            </div>
          </div>

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
        <div style={{ display: 'flex', flexDirection: 'column', height: '424px' }}>
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
              {profile?.recent_games && (
                <p style={{ margin: '0 0 6px 0' }}>좋아하는 것: {profile.recent_games}</p>
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

          {profile?.favorite_game_categories?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
              {profile.favorite_game_categories.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '20px',
                    background: '#FFFFFF',
                    border: '2px solid #6B9080',
                    color: '#6B9080',
                    fontSize: '13px',
                    fontWeight: '500',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
