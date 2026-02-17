import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function maskEmail(email) {
  const [local, domain] = email.split('@')
  if (local.length <= 2) return local[0] + '***@' + domain
  return local.slice(0, 2) + '***@' + domain
}

export default function EmailVerifyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email

  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (!email) {
      navigate('/login', { replace: true })
    }
  }, [email, navigate])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  if (!email) return null

  const handleVerify = async (e) => {
    e.preventDefault()
    if (otp.length !== 8) {
      setError('8자리 인증 코드를 입력해주세요.')
      return
    }
    setError('')
    setIsVerifying(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup',
      })
      if (error) {
        setError(error.message)
      } else {
        navigate('/profile/setup', { replace: true })
      }
    } catch {
      setError('인증 중 오류가 발생했습니다.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError('')
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })
      if (error) {
        setError(error.message)
      } else {
        setResendCooldown(60)
      }
    } catch {
      setError('재전송 중 오류가 발생했습니다.')
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '12px',
    fontSize: '20px',
    letterSpacing: '0.5em',
    textAlign: 'center',
    color: 'var(--text-primary)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
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
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '8px',
            letterSpacing: '-0.02em',
          }}>
            이메일 인증
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            이메일로 전송된 인증 코드를 입력해주세요
          </p>
          <p style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-secondary)',
            marginTop: '8px',
          }}>
            {maskEmail(email)}
          </p>
        </div>

        <form onSubmit={handleVerify}>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="00000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--button-primary)'
                e.target.style.boxShadow = '0 0 0 2px rgba(107,144,128,0.2)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(0,0,0,0.08)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {error && (
            <p style={{
              color: 'var(--danger)',
              fontSize: '13px',
              marginBottom: '16px',
              padding: '10px 12px',
              backgroundColor: 'rgba(220,38,38,0.06)',
              borderRadius: '10px',
              border: '1px solid rgba(220,38,38,0.1)',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isVerifying}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: 'var(--button-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: isVerifying ? 'not-allowed' : 'pointer',
              opacity: isVerifying ? 0.7 : 1,
              transition: 'all 0.2s',
              marginBottom: '12px',
            }}
            onMouseEnter={(e) => { if (!isVerifying) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)' }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
          >
            {isVerifying ? '인증 중...' : '인증하기'}
          </button>
        </form>

        <button
          onClick={handleResend}
          disabled={resendCooldown > 0}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: 'transparent',
            color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            marginBottom: '16px',
          }}
          onMouseEnter={(e) => { if (resendCooldown <= 0) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)' }}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {resendCooldown > 0 ? `${resendCooldown}초 후 재전송 가능` : '인증 코드 재전송'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <Link
            to="/login"
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
          >
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
