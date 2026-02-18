import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

const voteTypes = [
    { id: 'kind', label: '정말 친절해요', emoji: '😊' },
    { id: 'friendly', label: '친화력이 좋아요', emoji: '🤝' },
    { id: 'punctual', label: '약속 시간을 잘 지켜요', emoji: '⏰' },
    { id: 'cheerful', label: '유쾌해요', emoji: '😄' },
    { id: 'active', label: '적극적이에요', emoji: '🔥' },
    { id: 'vibe_maker', label: '분위기 메이커', emoji: '🎉' },
];

const allVoteTypeInfo = {
    thumbs_up: { label: '👍 좋아요', emoji: '👍' },
    thumbs_down: { label: '👎 별로예요', emoji: '👎' },
    kind: { label: '정말 친절해요', emoji: '😊' },
    friendly: { label: '친화력이 좋아요', emoji: '🤝' },
    punctual: { label: '약속 시간을 잘 지켜요', emoji: '⏰' },
    cheerful: { label: '유쾌해요', emoji: '😄' },
    active: { label: '적극적이에요', emoji: '🔥' },
    vibe_maker: { label: '분위기 메이커', emoji: '🎉' },
};

export default function PopularityPage() {
    const navigate = useNavigate();
    const { userId: paramUserId } = useParams();
    const { user, profile } = useAuth();
    const isMobile = useIsMobile();
    const [scores, setScores] = useState(null);
    const [recentVoters, setRecentVoters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [targetNickname, setTargetNickname] = useState(null);

    // 다른 유저를 보는 경우
    const isViewingOther = paramUserId && paramUserId !== user?.id;
    const targetUserId = paramUserId || user?.id;

    useEffect(() => {
        if (targetUserId) {
            // 다른 유저를 보려면 프리미엄이어야 함
            if (isViewingOther && !profile?.is_premium) {
                navigate('/popularity');
                return;
            }
            fetchData();
            if (isViewingOther) fetchTargetNickname();
        }
    }, [targetUserId, profile]);

    async function fetchTargetNickname() {
        const { data } = await supabase
            .from('profiles')
            .select('nickname')
            .eq('id', paramUserId)
            .maybeSingle();
        setTargetNickname(data?.nickname || '알 수 없음');
    }

    async function fetchData() {
        try {
            setLoading(true);

            const { data: scoreData } = await supabase
                .from('popularity_scores')
                .select('*')
                .eq('user_id', targetUserId)
                .maybeSingle();

            setScores(scoreData || {
                kind_count: 0,
                friendly_count: 0,
                punctual_count: 0,
                cheerful_count: 0,
                active_count: 0,
                total_score: 0,
            });

            const { data: votesData } = await supabase
                .from('popularity_votes')
                .select('vote_type, created_at, is_active')
                .eq('to_user_id', targetUserId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(10);

            setRecentVoters(votesData || []);
        } catch (err) {
            console.error('인기도 데이터 로드 오류:', err);
        } finally {
            setLoading(false);
        }
    }

    function formatTime(timestamp) {
        const now = new Date();
        const t = new Date(timestamp);
        const diffMs = now - t;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;

        return t.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }

    if (loading) {
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
                    <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>로딩 중...</p>
                </div>
            </div>
        );
    }

    const totalScore = scores?.total_score || 0;
    const totalVotes = voteTypes.reduce((sum, t) => sum + (scores?.[`${t.id}_count`] || 0), 0);
    const maxCount = Math.max(1, ...voteTypes.map(t => scores?.[`${t.id}_count`] || 0));

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '12px 4px' : '32px 24px', ...(isMobile ? { width: '85%' } : {}) }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <button
                    onClick={() => navigate(isViewingOther ? -1 : '/profile')}
                    style={{
                        padding: '6px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>
                <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--button-primary)', margin: 0 }}>
                    {isViewingOther ? `${targetNickname}님의 인기도` : '내 인기도'}
                </h1>
            </div>

            {/* 총점 카드 */}
            <div className="glass-strong" style={{
                borderRadius: '16px',
                padding: '28px 24px',
                marginBottom: '16px',
                textAlign: 'center',
            }}>
                <div style={{ fontSize: '40px', marginBottom: '4px' }}>⭐</div>
                <div style={{ marginBottom: '4px' }}>
                    <span style={{
                        fontSize: '48px',
                        fontWeight: '700',
                        color: totalScore >= 0 ? 'var(--button-primary)' : 'var(--danger)',
                    }}>
                        {totalScore >= 0 ? '+' : ''}{totalScore}
                    </span>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                    총 {totalVotes}개의 투표를 받았어요
                </p>
            </div>

            {/* 항목별 상세 */}
            <div className="glass" style={{
                borderRadius: '16px',
                overflow: 'hidden',
                marginBottom: '16px',
            }}>
                {voteTypes.map((type, index) => {
                    const count = scores?.[`${type.id}_count`] || 0;
                    const ratio = count / maxCount;

                    return (
                        <div
                            key={type.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                padding: '16px 20px',
                                borderBottom: index < voteTypes.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                            }}
                        >
                            <div style={{
                                fontSize: '24px',
                                flexShrink: 0,
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '12px',
                                backgroundColor: count > 0 ? 'rgba(107, 144, 128, 0.12)' : 'rgba(0,0,0,0.04)',
                            }}>
                                {type.emoji}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                                    }}>
                                        {type.label}
                                    </span>
                                    <span style={{
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        color: count > 0 ? 'var(--button-primary)' : 'var(--text-muted)',
                                    }}>
                                        {count > 0 ? `+${count}` : '0'}
                                    </span>
                                </div>
                                {/* 프로그레스 바 */}
                                <div style={{
                                    height: '6px',
                                    borderRadius: '3px',
                                    backgroundColor: 'rgba(0,0,0,0.06)',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{
                                        height: '100%',
                                        borderRadius: '3px',
                                        backgroundColor: count > 0 ? 'var(--button-primary)' : 'transparent',
                                        width: `${ratio * 100}%`,
                                        transition: 'width 0.4s ease',
                                    }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 최근 투표 기록 */}
            <div className="glass-strong" style={{
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '16px',
            }}>
                <h2 style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    marginBottom: '16px',
                }}>
                    최근 받은 투표
                </h2>
                {recentVoters.length === 0 ? (
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                        아직 받은 투표가 없어요
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {recentVoters.map((vote, index) => {
                            const typeInfo = allVoteTypeInfo[vote.vote_type];
                            if (!typeInfo) return null;

                            return (
                                <div
                                    key={index}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 14px',
                                        backgroundColor: 'rgba(255,255,255,0.5)',
                                        borderRadius: '10px',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '18px' }}>{typeInfo.emoji}</span>
                                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                                            누군가가 "{typeInfo.label}" 평가를 했어요
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                        {formatTime(vote.created_at)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 안내 */}
            <div className="glass" style={{
                borderRadius: '16px',
                padding: '20px 24px',
            }}>
                <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
                    인기도란?
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    <p style={{ margin: 0 }}>모임이 완료되면 함께한 멤버들을 평가할 수 있어요.</p>
                    <p style={{ margin: 0 }}>평가는 선택사항이며, 익명으로 진행돼요.</p>
                    <p style={{ margin: 0 }}>인기도가 높을수록 모임에서 신뢰도가 올라가요!</p>
                </div>
            </div>
        </div>
    );
}
