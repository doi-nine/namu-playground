import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Sparkles } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

export default function AIRecommendPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile: contextProfile } = useAuth();
    const isMobile = useIsMobile();
    const [gatherings, setGatherings] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const profile = location.state?.justCreatedProfile || contextProfile;

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        if (!profile) { navigate('/'); return; }
        fetchGatherings();
    }, [user, profile, navigate]);

    async function fetchGatherings() {
        try {
            // 이미 가입(신청 포함)한 모임 ID 조회
            const { data: joined } = await supabase
                .from('gathering_members')
                .select('gathering_id')
                .eq('user_id', user.id);
            const joinedIds = new Set((joined || []).map(m => m.gathering_id));

            const { data, error } = await supabase
                .from('gatherings')
                .select('*')
                .gte('datetime', new Date().toISOString())
                .neq('creator_id', user.id)
                .order('datetime', { ascending: true })
                .limit(50);

            if (error) throw error;

            // 가입한 모임(status 무관) + 정원 초과 제외
            const available = (data || []).filter(
                g => !joinedIds.has(g.id) && g.current_members < g.max_members
            ).slice(0, 20);
            setGatherings(available);
            if (available.length > 0) {
                await generateRecommendations(available);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('모임 로드 오류:', error);
            setLoading(false);
        }
    }

    async function generateRecommendations(gatheringsData) {
        if (!profile) { setLoading(false); return; }
        if (!profile.is_premium && profile.ai_recommendations_left <= 0) {
            alert('AI 추천 횟수를 모두 사용했습니다.');
            navigate('/premium');
            return;
        }
        setGenerating(true);
        try {
            const { data, error } = await supabase.functions.invoke('ai-recommend', {
                body: { profile, gatherings: gatheringsData }
            });
            if (error) throw error;
            const recs = data?.recommendations || [];
            if (recs.length === 0) {
                alert('현재 조건에 맞는 모임을 찾지 못했습니다. 횟수는 차감되지 않았습니다.');
                setRecommendations([]);
                return;
            }
            setRecommendations(recs);
            if (!profile.is_premium) {
                await supabase
                    .from('profiles')
                    .update({ ai_recommendations_left: Math.max(0, profile.ai_recommendations_left - 1) })
                    .eq('id', user.id);
            }
        } catch (error) {
            console.error('AI 추천 오류:', error);
            setRecommendations([]);
        } finally {
            setGenerating(false);
            setLoading(false);
        }
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
        return `${month}/${day}(${weekday})`;
    }

    if (loading || generating) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '40px', height: '40px',
                        border: '3px solid rgba(255,255,255,0.3)',
                        borderTop: '3px solid var(--button-primary)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto'
                    }} />
                    <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        {generating ? 'AI가 맞춤 모임을 찾고 있습니다...' : '로딩 중...'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '12px 4px' : '32px 24px', ...(isMobile ? { width: '93%' } : {}) }}>

            {/* 헤더 */}
            <div style={{ marginBottom: '20px' }}>
                <div className="glass-strong" style={{
                    borderRadius: '16px',
                    padding: '20px 24px',
                }}>
                    <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                        {profile?.nickname}님을 위한 추천
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                        프로필을 분석해 딱 맞는 모임 {recommendations.length}개를 찾았어요
                    </p>
                </div>
            </div>

            {/* 추천 결과 */}
            {recommendations.length === 0 ? (
                <div className="glass-strong" style={{ padding: '56px 24px', textAlign: 'center', borderRadius: '16px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>😢</div>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>
                        추천할 모임이 없습니다
                    </h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
                        횟수는 차감되지 않았습니다.
                    </p>
                    <button
                        onClick={() => navigate('/gatherings')}
                        style={{
                            padding: '12px 28px',
                            backgroundColor: 'var(--button-primary)',
                            color: '#FFFFFF',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
                    >
                        모든 모임 둘러보기
                    </button>
                </div>
            ) : (
                <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                    {recommendations.map((g, index) => (
                        <div
                            key={g.id}
                            onClick={() => navigate(`/gatherings/${g.id}`)}
                            style={{
                                padding: '20px 24px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                borderBottom: index < recommendations.length - 1 ? '1px solid #E5E7EB' : 'none',
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
                            {/* 제목 */}
                            <h3 style={{
                                fontSize: '17px',
                                fontWeight: '700',
                                color: 'var(--button-primary)',
                                margin: '0 0 6px 0',
                                lineHeight: 1.3,
                            }}>
                                {g.title}
                            </h3>

                            {/* 카테고리 */}
                            {g.category && (
                                <span style={{
                                    display: 'inline-block',
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    background: '#FFFFFF',
                                    border: '2px solid #6B9080',
                                    color: '#6B9080',
                                    fontSize: '11px',
                                    fontWeight: '500',
                                    marginBottom: '8px',
                                }}>
                                    #{g.category}
                                </span>
                            )}

                            {/* 설명 */}
                            <p style={{
                                fontSize: '14px',
                                color: 'var(--text-secondary)',
                                margin: '0 0 10px 0',
                                lineHeight: 1.5,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}>
                                {g.description}
                            </p>

                            {/* 정보 */}
                            <div style={{
                                display: 'flex',
                                gap: '14px',
                                fontSize: '13px',
                                color: 'var(--text-muted)',
                                marginBottom: g.reason ? '10px' : '0',
                                flexWrap: 'wrap',
                            }}>
                                <span>📅 {formatDate(g.datetime)}</span>
                                <span>📍 {g.location}</span>
                                <span>👥 {g.current_members}/{g.max_members}명</span>
                            </div>

                            {/* 추천 이유 */}
                            {g.reason && (
                                <div style={{
                                    padding: '10px 14px',
                                    backgroundColor: 'rgba(107, 144, 128, 0.08)',
                                    border: '1px solid rgba(107, 144, 128, 0.2)',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                }}>
                                    <Sparkles size={14} color="var(--button-primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
                                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                                        {g.reason}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 하단 버튼 */}
            {recommendations.length > 0 && (
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <button
                        onClick={() => navigate('/gatherings')}
                        style={{
                            padding: '12px 28px',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            border: '1px solid rgba(0,0,0,0.1)',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        모든 모임 둘러보기
                    </button>
                </div>
            )}
        </div>
    );
}
