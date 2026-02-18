import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function PremiumPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleCheckout = async () => {
        if (!user) {
            alert('로그인이 필요합니다.');
            navigate('/login');
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

            // Polar 체크아웃 페이지로 리다이렉트
            window.location.href = data.checkout_url;

        } catch (error) {
            console.error('결제 페이지 이동 오류:', error);
            alert('결제 페이지로 이동하는 중 오류가 발생했습니다.');
        } finally {
            setIsProcessing(false);
        }
    };

    const freeFeatures = [
        { icon: '🤖', title: 'AI 모임 맞춤 추천', desc: '월 3회' },
        { icon: '💬', title: 'AI 채팅 요약', desc: '월 3회' },
        { icon: '✍️', title: 'AI 글쓰기 보조 (모임/프로필)', desc: '월 3회' },
        { icon: '❤️', title: '매너도 확인', desc: '불가' },
        { icon: '🎨', title: '프로필 꾸미기', desc: '불가' },
        { icon: '👥', title: '일정 모집인원', desc: '최대 20명' },
    ];

    const premiumFeatures = [
        { icon: '✨', title: 'AI 전 기능 무제한', desc: '추천, 채팅 요약, 글쓰기 보조 모두 무제한' },
        { icon: '❤️', title: '매너도 확인 무제한', desc: '멤버들의 매너도를 자유롭게 확인하세요' },
        { icon: '🎨', title: '프로필 꾸미기', desc: '테마, 배지로 나만의 프로필을 꾸며보세요' },
        { icon: '📌', title: '모임 글 상단 노출', desc: '모임 리스트에서 내 모임이 먼저 보여요' },
        { icon: '👥', title: '일정 모집인원 확대', desc: '일정당 최대 100명까지 모집할 수 있어요' },
    ];

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '12px 4px' : '32px 24px', ...(isMobile ? { width: '93%' } : {}) }}>
            {/* 헤더 */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌳</div>
                <h1 style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    color: 'var(--button-primary)',
                    marginBottom: '8px'
                }}>
                    나무 놀이터 프리미엄
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                    더 많은 놀이 친구를 만나세요
                </p>
            </div>

            {/* 가격 카드 */}
            <div className="glass-strong" style={{
                borderRadius: '16px',
                padding: '28px 24px',
                marginBottom: '16px',
                textAlign: 'center'
            }}>
                <div style={{ marginBottom: '4px' }}>
                    <span style={{
                        fontSize: '40px',
                        fontWeight: '700',
                        color: 'var(--button-primary)'
                    }}>
                        $3
                    </span>
                    <span style={{
                        fontSize: '18px',
                        color: 'var(--text-muted)',
                        marginLeft: '2px'
                    }}>
                        /월
                    </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    약 4,300원, 커피 한 잔 값
                </p>
            </div>

            {/* 프리미엄 기능 */}
            <div style={{
                borderRadius: '16px',
                overflow: 'hidden',
                marginBottom: '16px',
                border: '2.5px solid rgba(107, 144, 128, 0.7)',
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                boxShadow: '0 4px 20px rgba(107, 144, 128, 0.18)',
            }}>
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(107, 144, 128, 0.25)',
                    backgroundColor: 'rgba(107, 144, 128, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <span style={{ fontSize: '16px' }}>👑</span>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--button-primary)', margin: 0 }}>
                        프리미엄
                    </h3>
                    <span style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: 'var(--button-primary)',
                        backgroundColor: 'rgba(107, 144, 128, 0.15)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                    }}>
                        $3/월
                    </span>
                </div>
                {premiumFeatures.map((feature, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '14px',
                            padding: '16px 20px',
                            borderBottom: index < premiumFeatures.length - 1 ? '1px solid rgba(107, 144, 128, 0.1)' : 'none',
                        }}
                    >
                        <div style={{
                            fontSize: '20px',
                            flexShrink: 0,
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(107, 144, 128, 0.12)',
                        }}>
                            {feature.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: 'var(--text-primary)',
                                marginBottom: '2px'
                            }}>
                                {feature.title}
                            </p>
                            <p style={{
                                fontSize: '13px',
                                color: 'var(--text-muted)',
                                lineHeight: '1.5'
                            }}>
                                {feature.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* 무료 사용자 */}
            <div className="glass" style={{
                borderRadius: '16px',
                overflow: 'hidden',
                marginBottom: '24px',
                opacity: 0.8,
            }}>
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    backgroundColor: 'rgba(0,0,0,0.02)'
                }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-secondary)', margin: 0 }}>
                        무료 사용자
                    </h3>
                </div>
                {freeFeatures.map((feature, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '14px 20px',
                            borderBottom: index < freeFeatures.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                        }}
                    >
                        <div style={{
                            fontSize: '20px',
                            flexShrink: 0,
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(0,0,0,0.04)',
                        }}>
                            {feature.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                                {feature.title}
                            </span>
                        </div>
                        <span style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: feature.desc === '불가' ? 'var(--danger)' : 'var(--text-muted)',
                        }}>
                            {feature.desc}
                        </span>
                    </div>
                ))}
            </div>

            {/* 결제 버튼 */}
            <button
                onClick={handleCheckout}
                disabled={isProcessing}
                style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: isProcessing ? 'rgba(0,0,0,0.12)' : 'var(--button-primary)',
                    color: '#FFFFFF',
                    fontSize: '16px',
                    fontWeight: '700',
                    borderRadius: '14px',
                    border: 'none',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '12px'
                }}
                onMouseEnter={(e) => { if (!isProcessing) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'; }}
                onMouseLeave={(e) => { if (!isProcessing) e.currentTarget.style.backgroundColor = 'var(--button-primary)'; }}
            >
                {isProcessing ? '처리 중...' : '프리미엄 시작하기'}
            </button>

            <p style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginBottom: '16px'
            }}>
                언제든지 취소할 수 있으며, 환불 정책이 적용됩니다.
            </p>

            {/* 돌아가기 */}
            <button
                onClick={() => navigate(-1)}
                style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
                돌아가기
            </button>
        </div>
    );
}
