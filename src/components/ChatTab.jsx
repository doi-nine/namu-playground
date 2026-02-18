import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function ChatTab({ gatheringId, memberStatus, isCreator }) {
    const { profile, refreshProfile } = useAuth();
    const isMobile = useIsMobile();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const isAtBottom = useRef(false);

    const [summaryLoading, setSummaryLoading] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [summaryText, setSummaryText] = useState('');
    const [summaryRemaining, setSummaryRemaining] = useState(null);

    const canChat = memberStatus === 'approved' || isCreator;

    useEffect(() => {
        fetchUser();
    }, []);

    useEffect(() => {
        if (gatheringId) {
            fetchMessages();

            // 5초마다 메시지 새로고침 (안정적인 방법)
            const interval = setInterval(() => {
                fetchMessages();
            }, 5000);

            return () => {
                clearInterval(interval);
            };
        }
    }, [gatheringId]);

    // 모바일: 새 메시지 도착 시 채팅창 최하단 자동 스크롤
    useEffect(() => {
        if (isMobile) { scrollToBottom(); }
    }, [messages]);

    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
    };

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`
          *,
          profiles (nickname, custom_badge, is_premium)
        `)
                .eq('gathering_id', gatheringId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            const newMessages = data || [];
            setMessages(prev => {
                // 메시지가 실제로 변경된 경우에만 상태 업데이트 (불필요한 re-render 방지)
                if (prev.length === newMessages.length &&
                    prev.length > 0 &&
                    prev[prev.length - 1].id === newMessages[newMessages.length - 1]?.id) {
                    return prev;
                }
                return newMessages;
            });
        } catch (error) {
            console.error('메시지 로딩 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !canChat) return;

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    gathering_id: gatheringId,
                    user_id: user.id,
                    content: newMessage.trim()
                })
                .select(`
          *,
          profiles (nickname, custom_badge, is_premium)
        `)
                .single();

            if (error) throw error;

            // 전송 성공하면 바로 메시지 목록에 추가
            setMessages(prev => [...prev, data]);
            setNewMessage('');
        } catch (error) {
            console.error('메시지 전송 실패:', error);
            alert('메시지 전송에 실패했습니다.');
        }
    };

    const handleSummarize = async () => {
        if (messages.length === 0) {
            alert('요약할 메시지가 없습니다.');
            return;
        }

        // 무료 유저 횟수 체크 (프론트 사전 검증)
        if (!profile?.is_premium) {
            const left = profile?.ai_chat_summary_left ?? 3;
            if (left <= 0) {
                alert('이번 달 무료 채팅 요약 횟수를 모두 사용했습니다. 프리미엄으로 업그레이드하면 무제한으로 이용할 수 있어요!');
                return;
            }
        }

        setSummaryLoading(true);
        try {
            const formatted = messages.map(msg => ({
                nickname: msg.profiles?.nickname || '알 수 없음',
                content: msg.content,
                time: new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit'
                })
            }));

            const { data, error } = await supabase.functions.invoke('ai-chat-summary', {
                body: { gathering_id: gatheringId, messages: formatted }
            });

            if (error) throw error;
            if (data?.error) {
                alert(data.error);
                return;
            }

            setSummaryText(data.summary);
            if (data.remaining !== null && data.remaining !== undefined) {
                setSummaryRemaining(data.remaining);
            }
            setShowSummaryModal(true);

            // 프로필 새로고침 (잔여 횟수 동기화)
            if (!profile?.is_premium) {
                refreshProfile();
            }
        } catch (err) {
            console.error('채팅 요약 오류:', err);
            alert('채팅 요약 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
        } finally {
            setSummaryLoading(false);
        }
    };

    const handleScroll = () => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const threshold = 80;
        isAtBottom.current = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    if (!canChat) {
        return (
            <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                    참가 후 대화에 참여하세요!
                </div>
                <div style={{ fontSize: '14px' }}>
                    모임에 참가 승인을 받으면 채팅에 참여할 수 있습니다.
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                메시지를 불러오는 중...
            </div>
        );
    }

    const summaryLeft = profile?.ai_chat_summary_left ?? 3;
    const isPremium = profile?.is_premium;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 300px)',
            minHeight: '500px'
        }}>
            {/* 메시지 리스트 */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="glass"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    borderRadius: '14px',
                    marginBottom: '16px'
                }}
            >
                {messages.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        padding: '48px 24px'
                    }}>
                        아직 메시지가 없습니다. 첫 메시지를 남겨보세요!
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMyMessage = msg.user_id === user?.id;

                        return (
                            <div
                                key={msg.id}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isMyMessage ? 'flex-end' : 'flex-start',
                                    marginBottom: '12px'
                                }}
                            >
                                {/* 닉네임 */}
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: 'var(--button-primary)',
                                    marginBottom: '4px',
                                    marginLeft: isMyMessage ? undefined : '4px',
                                    marginRight: isMyMessage ? '4px' : undefined,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}>
                                    {msg.profiles?.nickname || '알 수 없음'}
                                    {msg.profiles?.custom_badge && (
                                        <span style={{
                                            padding: '1px 6px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: '500',
                                            backgroundColor: 'rgba(107, 144, 128, 0.15)',
                                            color: 'var(--button-primary)',
                                        }}>
                                            {msg.profiles.custom_badge}
                                        </span>
                                    )}
                                </span>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    gap: '6px',
                                    flexDirection: isMyMessage ? 'row-reverse' : 'row',
                                    maxWidth: '70%'
                                }}>
                                    {/* 말풍선 */}
                                    <div style={{
                                        padding: '10px 14px',
                                        background: isMyMessage ? 'var(--button-primary)' : 'rgba(255,255,255,0.6)',
                                        color: isMyMessage ? '#FFFFFF' : 'var(--text-primary)',
                                        borderRadius: isMyMessage
                                            ? '16px 16px 4px 16px'
                                            : '16px 16px 16px 4px',
                                        fontSize: '14px',
                                        lineHeight: '1.5',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)'
                                    }}>
                                        {msg.content}
                                    </div>

                                    {/* 시간 */}
                                    <span style={{
                                        fontSize: '11px',
                                        color: 'var(--text-muted)',
                                        whiteSpace: 'nowrap',
                                        marginBottom: '2px'
                                    }}>
                                        {new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* 입력 필드 */}
            <div>
                <div className="glass" style={{
                    display: 'flex',
                    gap: isMobile ? '4px' : '8px',
                    padding: isMobile ? '10px 12px' : '16px',
                    borderRadius: '14px'
                }}>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder={isMobile ? '메시지 입력...' : '메시지를 입력하세요...'}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            padding: isMobile ? '9px 12px' : '12px 16px',
                            background: 'rgba(255,255,255,0.5)',
                            border: '1px solid rgba(0,0,0,0.06)',
                            borderRadius: '10px',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            outline: 'none'
                        }}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        style={{
                            padding: isMobile ? '9px 12px' : '12px 24px',
                            background: newMessage.trim() ? 'var(--button-primary)' : 'rgba(0,0,0,0.06)',
                            color: newMessage.trim() ? '#FFFFFF' : 'var(--text-muted)',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: '600',
                            cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                            fontSize: isMobile ? '11px' : '14px',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        전송
                    </button>
                    <button
                        onClick={handleSummarize}
                        disabled={summaryLoading || messages.length === 0}
                        title={isPremium ? 'AI 대화 요약' : `AI 대화 요약 (잔여 ${summaryLeft}회)`}
                        style={{
                            padding: isMobile ? '9px 12px' : '12px 16px',
                            background: '#FFFFFF',
                            color: summaryLoading || messages.length === 0 ? 'var(--text-muted)' : 'var(--button-primary)',
                            border: summaryLoading || messages.length === 0 ? '1.5px solid rgba(0,0,0,0.12)' : '1.5px solid var(--button-primary)',
                            borderRadius: '10px',
                            fontWeight: '600',
                            cursor: summaryLoading || messages.length === 0 ? 'not-allowed' : 'pointer',
                            fontSize: isMobile ? '12px' : '14px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: isMobile ? '3px' : '6px',
                            whiteSpace: 'nowrap',
                            position: 'relative',
                        }}
                    >
                        {summaryLoading ? (
                            <>
                                {!isMobile && <div style={{
                                    width: '12px', height: '12px',
                                    border: '2px solid rgba(107,144,128,0.2)',
                                    borderTop: '2px solid var(--button-primary)',
                                    borderRadius: '50%',
                                    animation: 'spin 0.8s linear infinite'
                                }} />}
                                요약 중
                            </>
                        ) : (
                            <>
                                {!isMobile && (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                    </svg>
                                )}
                                요약
                            </>
                        )}
                        {/* 무료 유저 잔여 횟수 배지 */}
                        {!isPremium && !summaryLoading && (
                            <span style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: summaryLeft > 0 ? 'var(--button-primary)' : 'var(--danger)',
                                color: '#FFFFFF',
                                fontSize: '10px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid white',
                            }}>
                                {summaryLeft}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* 요약 모달 */}
            {showSummaryModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        padding: '24px',
                    }}
                    onClick={() => setShowSummaryModal(false)}
                >
                    <div
                        style={{
                            backgroundColor: 'var(--card-bg, #fff)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            width: '100%',
                            maxWidth: '500px',
                            borderRadius: '20px',
                            padding: '28px',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                            </div>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                                    AI 대화 요약
                                </h3>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                                    {messages.length}개 메시지 분석 완료
                                </p>
                            </div>
                        </div>

                        <div style={{
                            padding: '16px',
                            backgroundColor: 'rgba(139, 92, 246, 0.06)',
                            borderRadius: '14px',
                            border: '1px solid rgba(139, 92, 246, 0.12)',
                            marginBottom: '16px',
                        }}>
                            <p style={{
                                fontSize: '14px',
                                color: 'var(--text-primary)',
                                lineHeight: '1.8',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                margin: 0,
                            }}>
                                {summaryText}
                            </p>
                        </div>

                        {summaryRemaining !== null && summaryRemaining !== undefined && (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '12px' }}>
                                이번 달 남은 무료 요약 횟수: {summaryRemaining}회
                            </p>
                        )}

                        <button
                            onClick={() => setShowSummaryModal(false)}
                            style={{
                                width: '100%',
                                padding: '14px',
                                backgroundColor: 'var(--button-primary)',
                                color: '#FFFFFF',
                                borderRadius: '12px',
                                fontWeight: '600',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '15px',
                                transition: 'all 0.2s',
                            }}
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}