import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Search, RefreshCw, Sparkles, Star } from 'lucide-react';
import { AVAILABLE_TAGS } from '../constants/tags';
import { useIsMobile } from '../hooks/useIsMobile';
import { useBookmarks } from '../context/BookmarkContext';

export default function GatheringListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();
  const hasRun = useRef(false);
  const isMobile = useIsMobile();

  const [gatherings, setGatherings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [recommendedTags, setRecommendedTags] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const { isBookmarked, toggleBookmark } = useBookmarks();

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // URL 파라미터에서 검색어 가져오기
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
    }

    fetchGatherings();
  }, []);

  useEffect(() => {
    shuffleTags();
  }, [profile]);

  function shuffleTags() {
    const userTags = profile?.favorite_game_categories || [];
    const userLocation = profile?.location;

    // 사용자 관심 태그 중 AVAILABLE_TAGS에 있는 것 우선
    const matched = AVAILABLE_TAGS.filter(t =>
      userTags.some(u => u.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(u.toLowerCase()))
    );

    // 사용자 지역과 겹치는 태그
    const locationTag = userLocation
      ? AVAILABLE_TAGS.find(t => userLocation.includes(t) || t.includes(userLocation))
      : null;
    if (locationTag && !matched.includes(locationTag)) matched.push(locationTag);

    // 나머지는 랜덤으로 채움
    const remaining = AVAILABLE_TAGS.filter(t => !matched.includes(t)).sort(() => Math.random() - 0.5);
    const result = [...matched, ...remaining].slice(0, 5);
    setRecommendedTags(result);
  }

  function handleRefreshTags() {
    setIsRefreshing(true);
    shuffleTags();
    setTimeout(() => setIsRefreshing(false), 400);
  }

  async function fetchGatherings() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('gatherings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 각 모임의 호스트와 승인된 멤버 수를 가져오기
      const gatheringsWithDetails = await Promise.all((data || []).map(async (gathering) => {
        // 호스트 정보
        const { data: host } = await supabase
          .from('profiles')
          .select('nickname, email, is_premium, custom_badge')
          .eq('id', gathering.creator_id)
          .single();

        // 승인된 멤버 수만 카운트
        const { count } = await supabase
          .from('gathering_members')
          .select('*', { count: 'exact', head: true })
          .eq('gathering_id', gathering.id)
          .eq('status', 'approved');

        return {
          ...gathering,
          host,
          members: [{ count: count || 0 }]
        };
      }));

      setGatherings(gatheringsWithDetails || []);
    } catch (error) {
      console.error('모임 로드 오류:', error);
      alert('모임을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAIRecommend() {
    if (!user || !profile) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (!profile.is_premium && profile.ai_recommendations_left <= 0) {
      navigate('/premium');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-recommend', {
        body: { userId: user.id }
      });

      if (error) throw error;

      const recommendations = data?.recommendations || [];

      if (recommendations.length === 0) {
        setAiRecommendations([]);
        setShowAIModal(true);
        return;
      }

      setAiRecommendations(recommendations);

      if (!profile.is_premium) {
        await supabase
          .from('profiles')
          .update({ ai_recommendations_left: Math.max(0, profile.ai_recommendations_left - 1) })
          .eq('id', user.id);
        await refreshProfile();
      }
    } catch (error) {
      console.error('AI 추천 오류:', error);
      alert('AI 추천 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingAI(false);
      setShowAIModal(true);
    }
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredGatherings = useMemo(() => {
    let result = [...gatherings];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(g =>
        g.title.toLowerCase().includes(query) ||
        g.description?.toLowerCase().includes(query) ||
        (g.tags && g.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    result.sort((a, b) => {
      const aPremium = a.host?.is_premium ? 1 : 0;
      const bPremium = b.host?.is_premium ? 1 : 0;
      if (aPremium !== bPremium) return bPremium - aPremium;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return result;
  }, [gatherings, searchQuery]);

  const totalPages = Math.ceil(filteredGatherings.length / PAGE_SIZE);
  const paginatedGatherings = filteredGatherings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
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
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>모임을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '12px 4px' : '32px 24px', ...(isMobile ? { width: '93%' } : {}) }}>
      {/* 검색 영역 */}
      <div style={{ marginBottom: '16px' }}>
        {isMobile ? (
          /* 모바일: 검색창 → AI 버튼 세로 배치 */
          <>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={20} color="var(--text-muted)"
                style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="키워드, 태그로 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '18px 48px 18px 50px',
                  borderRadius: '14px', border: '1px solid rgba(0,0,0,0.08)',
                  background: '#FFFFFF', fontSize: '17px',
                  color: 'var(--text-primary)', outline: 'none',
                  transition: 'all 0.2s', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--button-primary)'; e.target.style.borderColor = 'transparent'; }}
                onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'rgba(255,255,255,0.3)'; }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: '50%',
                    width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0, outline: 'none', color: '#666', fontSize: '14px', lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <button
              onClick={handleAIRecommend}
              disabled={isGeneratingAI}
              style={{
                width: '100%', padding: '14px 20px', borderRadius: '14px', border: 'none',
                background: 'var(--button-primary)', color: '#FFFFFF',
                fontSize: '15px', fontWeight: '600',
                cursor: isGeneratingAI ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '8px', transition: 'all 0.2s',
                opacity: isGeneratingAI ? 0.7 : 1, position: 'relative',
              }}
            >
              <Sparkles size={16} />
              {isGeneratingAI ? '분석 중...' : 'AI 맞춤 추천'}
              {!profile?.is_premium && !isGeneratingAI && (
                <span style={{
                  position: 'absolute', top: '-7px', right: '-7px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  backgroundColor: '#5a8a72', color: '#FFFFFF',
                  fontSize: '11px', fontWeight: '700',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid white', lineHeight: 1,
                }}>
                  {profile?.ai_recommendations_left ?? 3}
                </span>
              )}
            </button>
          </>
        ) : (
          /* 데스크탑: 검색창 + AI 버튼 같은 행 */
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} color="var(--text-muted)"
                style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="키워드, 태그로 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '14px 44px 14px 44px',
                  borderRadius: '14px', border: '1px solid rgba(0,0,0,0.08)',
                  background: '#FFFFFF', fontSize: '15px',
                  color: 'var(--text-primary)', outline: 'none',
                  transition: 'all 0.2s', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--button-primary)'; e.target.style.borderColor = 'transparent'; }}
                onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'rgba(255,255,255,0.3)'; }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: '50%',
                    width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0, outline: 'none', color: '#666', fontSize: '13px', lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <button
              onClick={handleAIRecommend}
              disabled={isGeneratingAI}
              style={{
                padding: '14px 20px', borderRadius: '14px', border: 'none',
                background: 'var(--button-primary)', color: '#FFFFFF',
                fontSize: '14px', fontWeight: '600',
                cursor: isGeneratingAI ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                whiteSpace: 'nowrap', transition: 'all 0.2s',
                opacity: isGeneratingAI ? 0.7 : 1, position: 'relative', flexShrink: 0,
              }}
              onMouseEnter={(e) => { if (!isGeneratingAI) e.currentTarget.style.background = 'var(--button-primary-hover)'; }}
              onMouseLeave={(e) => { if (!isGeneratingAI) e.currentTarget.style.background = 'var(--button-primary)'; }}
            >
              <Sparkles size={16} />
              {isGeneratingAI ? '분석 중...' : '맞춤 추천'}
              {!profile?.is_premium && !isGeneratingAI && (
                <span style={{
                  position: 'absolute', top: '-7px', right: '-7px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  backgroundColor: '#5a8a72', color: '#FFFFFF',
                  fontSize: '11px', fontWeight: '700',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid white', lineHeight: 1,
                }}>
                  {profile?.ai_recommendations_left ?? 3}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 추천 태그 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '28px',
        flexWrap: 'wrap',
      }}>
        {recommendedTags.map((tag, i) => (
          <button
            key={i}
            onClick={() => setSearchQuery(tag)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: '2px solid #6B9080',
              background: '#FFFFFF',
              color: '#6B9080',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#6B9080';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#FFFFFF';
              e.currentTarget.style.color = '#6B9080';
            }}
          >
            #{tag}
          </button>
        ))}
        <button
          onClick={handleRefreshTags}
          style={{
            padding: '6px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s',
            transform: isRefreshing ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <RefreshCw size={14} color="var(--text-secondary)" />
        </button>
      </div>

      {/* 모임 카드 리스트 */}
      <div className="glass" style={{
        borderRadius: '16px',
        overflow: 'hidden',
        ...(isMobile ? { background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.8))' } : {}),
      }}>
        {filteredGatherings.length === 0 ? (
          <div style={{
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              검색 결과가 없습니다.
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--button-primary)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                검색 초기화
              </button>
            )}
          </div>
        ) : (
          paginatedGatherings.map((gathering, index) => {
            const isPremium = gathering.host?.is_premium;
            return (
              <div
                key={gathering.id}
                onClick={() => navigate(`/gatherings/${gathering.id}`)}
                style={{
                  padding: isMobile ? '20px 16px' : '20px 24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: 'transparent',
                  borderBottom: index < paginatedGatherings.length - 1 ? '1px solid #E5E7EB' : 'none',
                  borderLeft: isPremium ? '4px solid #C5D89D' : undefined,
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* 별 즐겨찾기 버튼 */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBookmark(gathering.id, gathering.title); }}
                  style={{
                    position: 'absolute', top: '16px', right: '16px',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    borderRadius: '6px', transition: 'background-color 0.2s',
                  }}
                >
                  <Star
                    size={18}
                    fill={isBookmarked(gathering.id) ? 'var(--button-primary)' : 'none'}
                    color="var(--button-primary)"
                  />
                </button>

                {/* 제목 (하이라이트 배경) */}
                <h4 style={{
                  fontSize: isMobile ? '19px' : '17px',
                  fontWeight: '600',
                  color: 'var(--button-primary)',
                  margin: '0 0 6px 0',
                  lineHeight: 1.3,
                  paddingRight: '28px',
                }}>
                  {gathering.title}
                </h4>

                {/* 호스트 | 인원 */}
                <div style={{
                  fontSize: isMobile ? '15px' : '13px',
                  color: 'var(--text-muted)',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}>
                  <span>모임장: {gathering.host?.nickname || '익명'}</span>
                  {gathering.host?.is_premium && gathering.host?.custom_badge && (
                    <span style={{
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '500',
                      backgroundColor: 'rgba(107, 144, 128, 0.15)',
                      color: 'var(--button-primary)',
                    }}>
                      {gathering.host.custom_badge}
                    </span>
                  )}
                  <span>| {gathering.members?.[0]?.count || 0}명</span>
                </div>

                {/* 태그 */}
                {gathering.tags && gathering.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {gathering.tags.map((tag, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchQuery(tag);
                        }}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: '#FFFFFF',
                          border: '2px solid #6B9080',
                          color: '#6B9080',
                          fontSize: '11px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#6B9080';
                          e.currentTarget.style.color = '#FFFFFF';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#FFFFFF';
                          e.currentTarget.style.color = '#6B9080';
                        }}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '24px' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)',
              background: currentPage === 1 ? 'rgba(0,0,0,0.04)' : '#FFFFFF',
              color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: '500', transition: 'all 0.2s',
            }}
          >
            ‹
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              style={{
                padding: '8px 13px', borderRadius: '10px',
                border: page === currentPage ? 'none' : '1px solid rgba(0,0,0,0.1)',
                background: page === currentPage ? 'var(--button-primary)' : '#FFFFFF',
                color: page === currentPage ? '#FFFFFF' : 'var(--text-primary)',
                cursor: 'pointer', fontSize: '14px', fontWeight: page === currentPage ? '700' : '400',
                transition: 'all 0.2s',
              }}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)',
              background: currentPage === totalPages ? 'rgba(0,0,0,0.04)' : '#FFFFFF',
              color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: '500', transition: 'all 0.2s',
            }}
          >
            ›
          </button>
        </div>
      )}

      {/* AI 추천 모달 */}
      {showAIModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px',
          }}
          onClick={() => setShowAIModal(false)}
        >
          <div
            className="glass-strong"
            style={{
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Sparkles size={20} color="var(--button-primary)" />
                AI 추천 결과
              </h2>
              <button
                onClick={() => setShowAIModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ×
              </button>
            </div>

            {aiRecommendations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  현재 조건에 맞는 모임을 찾지 못했습니다.
                </p>
                {!profile?.is_premium && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>횟수는 차감되지 않았습니다.</p>
                )}
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
                  회원님의 프로필을 바탕으로 {aiRecommendations.length}개의 모임을 추천합니다!
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {aiRecommendations.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => { setShowAIModal(false); navigate(`/gatherings/${g.id}`); }}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid rgba(0,0,0,0.06)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--button-primary)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <h3 style={{
                        fontSize: '15px',
                        fontWeight: '600',
                        color: 'var(--button-primary)',
                        marginBottom: '6px',
                      }}>
                        {g.title}
                      </h3>
                      {g.tags && g.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {g.tags.map((tag, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAIModal(false);
                                setSearchQuery(tag);
                              }}
                              style={{
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: '#FFFFFF',
                                border: '2px solid #6B9080',
                                color: '#6B9080',
                                fontSize: '11px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#6B9080';
                                e.currentTarget.style.color = '#FFFFFF';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#FFFFFF';
                                e.currentTarget.style.color = '#6B9080';
                              }}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {g.current_members}명
                      </div>
                      {g.reason && (
                        <div style={{
                          marginTop: '8px',
                          padding: '10px',
                          borderRadius: '8px',
                          background: 'rgba(107,144,128,0.1)',
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                        }}>
                          {g.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowAIModal(false)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginTop: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
