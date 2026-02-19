import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const action = isLogin ? signIn : signUp
    const { data, error } = await action(email, password)
    if (error) {
      if (error.message?.toLowerCase().includes('rate limit')) {
        setError('잠시 후 다시 시도해주세요. (이메일 발송 제한)')
      } else {
        setError(error.message)
      }
    } else {
      if (isLogin) {
        // 기존 회원: AuthGate가 프로필 확인 후 처리
        navigate('/gatherings')
      } else if (data?.session) {
        // 이메일 인증 비활성화: 즉시 세션 생성됨 → 프로필 작성으로
        navigate('/profile/setup', { replace: true })
      } else {
        // 이메일 인증 활성화: 인증 페이지로
        navigate('/verify-email', { state: { email } })
      }
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        borderRadius: '24px',
        padding: '48px 36px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.3))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.5)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            나무 놀이터
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>다 큰 어른들의 놀이터</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px',
                fontSize: '14px', color: 'var(--text-primary)', backgroundColor: 'rgba(255,255,255,0.6)', outline: 'none',
                boxSizing: 'border-box', transition: 'all 0.2s'
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--button-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(107,144,128,0.2)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px',
                fontSize: '14px', color: 'var(--text-primary)', backgroundColor: 'rgba(255,255,255,0.6)', outline: 'none',
                boxSizing: 'border-box', transition: 'all 0.2s'
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--button-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(107,144,128,0.2)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {error && (
            <p style={{
              color: 'var(--danger)', fontSize: '13px', marginBottom: '16px', padding: '10px 12px',
              backgroundColor: 'rgba(220,38,38,0.06)', borderRadius: '10px', border: '1px solid rgba(220,38,38,0.1)'
            }}>{error}</p>
          )}

          <button type="submit" style={{
            width: '100%', padding: '14px', backgroundColor: 'var(--button-primary)', color: '#FFFFFF',
            border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600',
            cursor: 'pointer', transition: 'all 0.2s', marginBottom: '12px'
          }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
          >
            {isLogin ? '로그인' : '회원가입'}
          </button>
        </form>

        <div style={{
          display: 'flex', alignItems: 'center', margin: '20px 0',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0,0,0,0.1)' }} />
          <span style={{ padding: '0 12px', fontSize: '13px', color: 'var(--text-muted)' }}>또는</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0,0,0,0.1)' }} />
        </div>

        <button onClick={signInWithGoogle} style={{
          width: '100%', padding: '12px', backgroundColor: '#ffffff', color: 'var(--text-primary)',
          border: '1px solid rgba(0,0,0,0.12)', borderRadius: '12px', fontSize: '14px', fontWeight: '500',
          cursor: 'pointer', transition: 'all 0.2s', marginBottom: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Google로 계속하기
        </button>

        <button onClick={() => setIsLogin(!isLogin)} style={{
          width: '100%', padding: '12px', backgroundColor: 'transparent', color: 'var(--text-secondary)',
          border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', fontSize: '14px', fontWeight: '500',
          cursor: 'pointer', transition: 'all 0.2s'
        }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {isLogin ? '회원가입으로 전환' : '로그인으로 전환'}
        </button>
      </div>
    </div>
  )
}
