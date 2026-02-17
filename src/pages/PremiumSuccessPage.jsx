import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function PremiumSuccessPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isActivated, setIsActivated] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const checkPremium = setInterval(async () => {
            const { data } = await supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', user.id)
                .single();

            if (data?.is_premium) {
                setIsActivated(true);
                clearInterval(checkPremium);
                setTimeout(() => {
                    navigate('/');
                }, 2000);
            }
        }, 2000);

        const timeout = setTimeout(() => {
            clearInterval(checkPremium);
            navigate('/');
        }, 10000);

        return () => {
            clearInterval(checkPremium);
            clearTimeout(timeout);
        };
    }, [user, navigate]);

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
            <div className="glass-strong" style={{
                borderRadius: '20px',
                padding: '48px 36px',
                maxWidth: '448px',
                margin: '0 auto',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '64px', marginBottom: '24px' }}>🌳</div>

                {isActivated ? (
                    <>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: 'var(--button-primary)' }}>프리미엄 활성화!</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>이제 모든 기능을 무제한으로 사용하실 수 있습니다</p>
                    </>
                ) : (
                    <>
                        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>환영합니다!</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>프리미엄 결제가 완료되었습니다</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--button-primary)' }}>
                            <div style={{
                                width: '20px', height: '20px',
                                border: '2px solid rgba(255,255,255,0.3)',
                                borderTop: '2px solid var(--button-primary)',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite'
                            }} />
                            <span style={{ fontSize: '14px', fontWeight: '500' }}>프리미엄 활성화 중...</span>
                        </div>
                    </>
                )}

                <div style={{
                    marginTop: '32px',
                    padding: '14px',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    borderRadius: '10px',
                    border: '1px solid rgba(0,0,0,0.06)'
                }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        잠시 후 자동으로 홈으로 이동합니다
                    </div>
                </div>
            </div>
        </div>
    );
}
