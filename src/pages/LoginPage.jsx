import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
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
      setError(error.message)
    } else {
      // 프로필 존재 여부 확인 후 분기
      const userId = data?.user?.id
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle()
        navigate(profile ? '/gatherings' : '/profile/setup')
      } else {
        navigate('/')
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
