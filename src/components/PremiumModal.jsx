import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function PremiumModal({ isOpen, onClose }) {
    const { user } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleUpgrade = async () => {
        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }

        setIsProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const { data, error } = await supabase.functions.invoke('polar-checkout', {
                body: {
                    user_id: user.id,
                    user_email: user.email
                },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
                }
            });

            if (error) throw error;

            window.location.href = data.checkout_url;

        } catch (error) {
            console.error('결제 페이지 이동 오류:', error);
            alert('결제 페이지로 이동하는 중 오류가 발생했습니다.');
            setIsProcessing(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px'
        }}>
            <div className="glass-strong" style={{
                borderRadius: '20px',
                padding: '32px',
                maxWidth: '420px',
                width: '100%',
                boxShadow: '0 16px 48px rgba(0,0,0,0.12)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌳</div>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>
                        더 많은 놀이 추천을 받고 싶다면?
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>프리미엄으로 더 많은 혜택을 누려보세요</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    {[
                        { emoji: '✨', title: 'AI 전 기능 무제한', desc: '추천, 채팅 요약, 글쓰기 보조 모두 무제한' },
                        { emoji: '⭐', title: '매너도 확인 무제한', desc: '멤버들의 매너도를 자유롭게 확인하세요' },
                        { emoji: '🎨', title: '프로필 꾸미기 & 상단 노출', desc: '테마, 배지, 모임 글 상단 노출' }
                    ].map((item, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            padding: '12px',
                            backgroundColor: 'rgba(255,255,255,0.5)',
                            borderRadius: '10px'
                        }}>
                            <span style={{ fontSize: '24px' }}>{item.emoji}</span>
                            <div>
                                <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '14px' }}>{item.title}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{
                    backgroundColor: 'var(--button-primary)',
                    color: 'white',
                    padding: '16px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    marginBottom: '20px'
                }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '2px' }}>$3/월</div>
                    <div style={{ fontSize: '13px', opacity: 0.9 }}>약 4,300원, 커피 한 잔 값</div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '14px',
                            border: '1px solid rgba(0,0,0,0.08)',
                            borderRadius: '12px',
                            color: 'var(--text-secondary)',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        나중에
                    </button>
                    <button
                        onClick={handleUpgrade}
                        disabled={isProcessing}
                        style={{
                            flex: 1,
                            padding: '14px',
                            backgroundColor: isProcessing ? 'rgba(0,0,0,0.06)' : 'var(--button-primary)',
                            color: isProcessing ? 'var(--text-muted)' : '#FFFFFF',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            opacity: isProcessing ? 0.6 : 1,
                            fontSize: '14px',
                            fontWeight: '700',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { if (!isProcessing) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'; }}
                        onMouseLeave={(e) => { if (!isProcessing) e.currentTarget.style.backgroundColor = 'var(--button-primary)'; }}
                    >
                        {isProcessing ? '처리 중...' : '결제하기'}
                    </button>
                </div>
            </div>
        </div>
    );
}
