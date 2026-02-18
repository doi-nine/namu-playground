import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function PopularityWidget({ targetUserId, targetUserName }) {
    const { user, profile } = useAuth();
    const [scores, setScores] = useState(null);
    const [myVotes, setMyVotes] = useState({});
    const [canVoteToday, setCanVoteToday] = useState(true);
    const [loading, setLoading] = useState(true);
    const [showVotePanel, setShowVotePanel] = useState(false);

    const voteTypes = [
        { id: 'kind', label: '정말 친절해요', emoji: '😊' },
        { id: 'friendly', label: '친화력이 좋아요', emoji: '🤝' },
        { id: 'punctual', label: '약속 시간을 잘 지켜요', emoji: '⏰' },
        { id: 'cheerful', label: '유쾌해요', emoji: '😄' },
        { id: 'active', label: '적극적이에요', emoji: '🔥' }
    ];

    useEffect(() => {
        if (profile?.is_premium) {
            fetchPopularityData();
        }
    }, [targetUserId, profile]);

    const fetchPopularityData = async () => {
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
                total_score: 0
            });

            if (user && user.id !== targetUserId) {
                const { data: votesData } = await supabase
                    .from('popularity_votes')
                    .select('vote_type, is_active')
                    .eq('from_user_id', user.id)
                    .eq('to_user_id', targetUserId);

                const votesMap = {};
                votesData?.forEach(vote => {
                    votesMap[vote.vote_type] = vote.is_active;
                });
                setMyVotes(votesMap);

                const today = new Date().toISOString().split('T')[0];
                const { data: limitData } = await supabase
                    .from('daily_vote_limits')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('target_user_id', targetUserId)
                    .eq('last_voted_at', today)
                    .maybeSingle();

                setCanVoteToday(!limitData);
            }

        } catch (error) {
            console.error('인기도 데이터 로드 오류:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (voteType) => {
        if (!user || user.id === targetUserId) return;

        try {
            const currentState = myVotes[voteType] || false;
            const newState = !currentState;

            const { error } = await supabase.functions.invoke('vote-popularity', {
                body: {
                    target_user_id: targetUserId,
                    vote_type: voteType,
                    is_active: newState
                }
            });

            if (error) throw error;

            setMyVotes(prev => ({ ...prev, [voteType]: newState }));
            await fetchPopularityData();

            if (!Object.values(myVotes).some(v => v) && newState) {
                setCanVoteToday(false);
            }

        } catch (error) {
            console.error('투표 오류:', error);
            alert(error.message || '투표 중 오류가 발생했습니다.');
        }
    };

    if (!profile?.is_premium) {
        return null;
    }

    if (loading) {
        return (
            <div className="glass-strong" style={{
                borderRadius: '14px',
                padding: '24px'
            }}>
                <div style={{ opacity: 0.6 }}>
                    <div style={{
                        height: '20px',
                        background: 'rgba(0,0,0,0.06)',
                        borderRadius: '4px',
                        width: '120px',
                        marginBottom: '12px'
                    }} />
                    <div style={{
                        height: '14px',
                        background: 'rgba(0,0,0,0.06)',
                        borderRadius: '4px',
                        width: '100%'
                    }} />
                </div>
            </div>
        );
    }

    const isOwnProfile = user?.id === targetUserId;
    const totalScore = scores?.total_score || 0;

    return (
        <div className="glass-strong" style={{
            borderRadius: '14px',
            padding: '24px'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
            }}>
                <h2 style={{
                    fontSize: '17px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                    color: 'var(--text-primary)'
                }}>
                    ❤️ 매너도
                    <span style={{
                        fontSize: '22px',
                        fontWeight: '700',
                        color: totalScore >= 0 ? 'var(--button-primary)' : 'var(--danger)'
                    }}>
                        {totalScore >= 0 ? '+' : ''}{totalScore}
                    </span>
                </h2>
                {!isOwnProfile && (
                    <button
                        onClick={() => setShowVotePanel(!showVotePanel)}
                        style={{
                            padding: '8px 14px',
                            background: 'var(--button-primary)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '13px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
                    >
                        {showVotePanel ? '닫기' : '투표하기'}
                    </button>
                )}
            </div>

            {/* 인기도 항목별 표시 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {voteTypes.map(type => {
                    const count = scores?.[`${type.id}_count`] || 0;
                    if (count === 0) return null;

                    return (
                        <div key={type.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            background: 'rgba(255,255,255,0.5)',
                            borderRadius: '8px'
                        }}>
                            <span style={{
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'var(--text-primary)'
                            }}>
                                <span style={{ fontSize: '18px' }}>{type.emoji}</span>
                                {type.label}
                            </span>
                            <span style={{ fontWeight: '700', color: 'var(--button-primary)', fontSize: '13px' }}>+{count}</span>
                        </div>
                    );
                })}
            </div>

            {/* 투표 패널 */}
            {showVotePanel && !isOwnProfile && (
                <div style={{
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    paddingTop: '16px',
                    marginTop: '16px'
                }}>
                    {!canVoteToday && Object.keys(myVotes).length === 0 && (
                        <div style={{
                            background: 'rgba(245,158,11,0.08)',
                            border: '1px solid rgba(245,158,11,0.15)',
                            color: 'var(--text-secondary)',
                            padding: '12px',
                            borderRadius: '10px',
                            marginBottom: '14px',
                            fontSize: '13px'
                        }}>
                            ⏰ 하루에 한 번만 투표할 수 있습니다. 내일 다시 시도해주세요!
                        </div>
                    )}

                    <p style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        marginBottom: '10px',
                        marginTop: 0
                    }}>
                        {targetUserName}님에게 어떤 점이 좋았나요? (중복 선택 가능)
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {voteTypes.map(type => {
                            const isActive = myVotes[type.id] || false;
                            const hasVotedAny = Object.values(myVotes).some(v => v);
                            const canToggle = canVoteToday || hasVotedAny;

                            return (
                                <button
                                    key={type.id}
                                    onClick={() => canToggle && handleVote(type.id)}
                                    disabled={!canToggle}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        fontWeight: '500',
                                        transition: 'all 0.2s',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        border: 'none',
                                        cursor: canToggle ? 'pointer' : 'not-allowed',
                                        fontSize: '13px',
                                        background: isActive
                                            ? 'var(--button-primary)'
                                            : canToggle
                                            ? 'rgba(255,255,255,0.5)'
                                            : 'rgba(0,0,0,0.03)',
                                        color: isActive
                                            ? '#FFFFFF'
                                            : canToggle
                                            ? 'var(--text-primary)'
                                            : 'var(--text-muted)'
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '18px' }}>{type.emoji}</span>
                                        {type.label}
                                    </span>
                                    {isActive && <span style={{ fontSize: '16px' }}>✓</span>}
                                </button>
                            );
                        })}
                    </div>

                    <p style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginTop: '10px',
                        marginBottom: 0
                    }}>
                        💡 투표는 익명으로 진행되며, 선택을 취소할 수도 있습니다.
                    </p>
                </div>
            )}
        </div>
    );
}
