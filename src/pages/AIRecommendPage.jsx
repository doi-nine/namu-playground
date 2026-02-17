import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function AIRecommendPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile: contextProfile } = useAuth();
    const [gatherings, setGatherings] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const profile = location.state?.justCreatedProfile || contextProfile;

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        if (!profile) {
            navigate('/');
            return;
        }

        fetchGatherings();
    }, [user, profile, navigate]);

    async function fetchGatherings() {
        try {
            const { data, error } = await supabase
                .from('gatherings')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setGatherings(data || []);

            if (data && data.length > 0) {
                await generateRecommendations(data);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('모임 로드 오류:', error);
            alert('모임을 불러오는데 실패했습니다.');
            setLoading(false);
        }
    }

    async function generateRecommendations(gatheringsData) {
        if (!profile) {
            setLoading(false);
            return;
        }

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
            alert('AI 추천 중 오류가 발생했습니다.');
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
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
            <button
                onClick={() => navigate('/gatherings')}
                style={{
                    color: 'var(--button-primary)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginBottom: '16px',
                    padding: 0,
                    fontWeight: '500'
                }}
            >
                ← 모임 목록으로
            </button>

            <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: 'var(--button-primary)' }}>
                🎯 AI 맞춤 추천
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
                {profile?.nickname}님의 프로필을 기반으로 추천된 모임입니다
            </p>

            {recommendations.length === 0 ? (
                <div className="glass-strong" style={{ padding: '48px', textAlign: 'center', borderRadius: '16px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>😢</div>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>추천할 모임이 없습니다</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>횟수는 차감되지 않았습니다.</p>
                    <button
                        onClick={() => navigate('/gatherings')}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: 'var(--button-primary)',
                            color: '#FFFFFF',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
                    >
                        모든 모임 둘러보기
                    </button>
                </div>
            ) : (
                <div className="glass-strong" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                    {recommendations.map((g, index) => (
                        <div
                            key={g.id}
                            onClick={() => navigate(`/gatherings/${g.id}`)}
                            style={{
                                padding: '20px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                borderBottom: index < recommendations.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <span style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                backgroundColor: '#FFFFFF',
                                border: '2px solid #60A5FA',
                                color: '#2563EB'
                            }}>{g.category}</span>

                            <h3 style={{ fontSize: '17px', fontWeight: '600', marginTop: '8px', color: 'var(--text-primary)', marginBottom: '6px' }}>{g.title}</h3>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '10px' }}>{g.description}</p>

                            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                <span>📅 {formatDate(g.datetime)}</span>
                                <span>📍 {g.location}</span>
                                <span>👥 {g.current_members}/{g.max_members}명</span>
                            </div>

                            {g.reason && (
                                <div style={{
                                    marginTop: '10px',
                                    padding: '10px 12px',
                                    backgroundColor: 'rgba(122,184,142,0.1)',
                                    border: '1px solid rgba(122,184,142,0.2)',
                                    borderRadius: '10px'
                                }}>
                                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>💡 추천 이유: {g.reason}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
