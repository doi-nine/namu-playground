import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function ChatTab({ gatheringId, memberStatus, isCreator }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const messagesEndRef = useRef(null);

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

    useEffect(() => {
        scrollToBottom();
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
          profiles (nickname)
        `)
                .eq('gathering_id', gatheringId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
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
          profiles (nickname)
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

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 300px)',
            minHeight: '500px'
        }}>
            {/* 메시지 리스트 */}
            <div className="glass" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                borderRadius: '14px',
                marginBottom: '16px'
            }}>
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
                                {/* 닉네임 (내 메시지가 아닐 때만) */}
                                {!isMyMessage && (
                                    <span style={{
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: 'var(--button-primary)',
                                        marginBottom: '4px',
                                        marginLeft: '4px'
                                    }}>
                                        {msg.profiles?.nickname || '알 수 없음'}
                                    </span>
                                )}

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
            <div className="glass" style={{
                display: 'flex',
                gap: '8px',
                padding: '16px',
                borderRadius: '14px',
                position: 'sticky',
                bottom: 0
            }}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="메시지를 입력하세요..."
                    style={{
                        flex: 1,
                        padding: '12px 16px',
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
                        padding: '12px 24px',
                        background: newMessage.trim() ? 'var(--button-primary)' : 'rgba(0,0,0,0.06)',
                        color: newMessage.trim() ? '#FFFFFF' : 'var(--text-muted)',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '600',
                        cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                        fontSize: '14px',
                        transition: 'all 0.2s'
                    }}
                >
                    전송
                </button>
            </div>
        </div>
    );
}
