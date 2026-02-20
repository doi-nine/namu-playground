import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import { useAuth } from '../context/AuthContext'

/* ─── useScrollReveal ─── */
function useScrollReveal({
  animation = 'fadeInUp',
  duration = '0.8s',
  delay = '0s',
  threshold = 0.15,
  easing = 'cubic-bezier(0.16, 1, 0.3, 1)',
} = {}) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.animation = `${animation} ${duration} ${easing} ${delay} forwards`
          observer.unobserve(el)
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [animation, duration, delay, threshold, easing])
  return ref
}

/* ─── useScrollProgress ─── */
function useScrollProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return progress
}

/* ─── useCountUp ─── */
function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const start = performance.now()
    const step = (now) => {
      const elapsed = now - start
      const ratio = Math.min(elapsed / duration, 1)
      // ease-out quad
      const eased = 1 - (1 - ratio) * (1 - ratio)
      setValue(Math.round(eased * target))
      if (ratio < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, target, duration])

  return { ref, value }
}

/* ─── RevealSection ─── */
function RevealSection({ children, style, animation = 'fadeInUp', delay = '0s', duration = '0.8s', threshold = 0.15 }) {
  const ref = useScrollReveal({ animation, delay, duration, threshold })
  return (
    <div ref={ref} style={{ opacity: 0, ...style }}>
      {children}
    </div>
  )
}

/* ─── GlassCard ─── */
function GlassCard({ children, index, isMobile, style, animation, delay }) {
  const [hovered, setHovered] = useState(false)

  return (
    <RevealSection
      animation={animation}
      delay={delay || `${index * 0.15}s`}
      style={style}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(255,255,255,0.3))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: '24px',
          padding: isMobile ? '30px 26px' : '38px 34px',
          boxShadow: hovered
            ? '0 16px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.6)'
            : '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
          transform: hovered ? 'translateY(-6px) scale(1.01)' : 'translateY(0) scale(1)',
          transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s cubic-bezier(0.16,1,0.3,1)',
          cursor: 'default',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* shine sweep overlay */}
        {hovered && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '60%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              animation: 'shineSweep 0.6s ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        )}
        {children}
      </div>
    </RevealSection>
  )
}

/* ─── SectionHeader ─── */
function SectionHeader({ children, headingSize }) {
  return (
    <RevealSection style={{ textAlign: 'center', marginBottom: '60px' }}>
      <h2 style={{
        fontSize: headingSize,
        fontWeight: '800',
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em',
      }}>
        {children}
      </h2>
    </RevealSection>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { user, enterGuestMode } = useAuth()
  const problemsRef = useRef(null)
  const solutionsRef = useRef(null)
  const timelineRef = useRef(null)
  const ctaRef = useRef(null)
  const scrollProgress = useScrollProgress()

  // 모바일 전역 CSS(html,body overflow:hidden)를 랜딩페이지에서만 해제
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.style.overflow = 'auto'
    html.style.height = 'auto'
    body.style.overflow = 'auto'
    body.style.height = 'auto'
    return () => {
      html.style.overflow = ''
      html.style.height = ''
      body.style.overflow = ''
      body.style.height = ''
    }
  }, [])

  const scrollToProblems = () => {
    problemsRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sectionPadding = isMobile ? '80px 20px' : '140px 40px'
  const headingSize = isMobile ? '32px' : '48px'
  const subHeadingSize = isMobile ? '22px' : '30px'
  const bodySize = isMobile ? '15px' : '18px'

  const ctaButton = (
    <button
      onClick={() => navigate(user ? '/gatherings' : '/login')}
      style={{
        padding: isMobile ? '16px 36px' : '18px 48px',
        background: 'linear-gradient(135deg, var(--button-primary), #5A7A6D)',
        color: '#fff',
        border: 'none',
        borderRadius: '16px',
        fontSize: isMobile ? '16px' : '18px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: '0 4px 24px rgba(107,144,128,0.4)',
        animation: 'glowPulse 3s ease-in-out infinite',
        letterSpacing: '0.02em',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(107,144,128,0.55)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)'
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(107,144,128,0.4)'
      }}
    >
      무료로 시작하기
    </button>
  )

  const problems = [
    { emoji: '😔', title: '혼자 보내는 주말', desc: '같이 놀 사람을 찾기가 어렵고, SNS로는 진짜 관심사가 맞는 사람을 만나기 힘들어요.' },
    { emoji: '🎭', title: '억지 모임에 지친 날', desc: '관심 없는 모임에 얼굴 도장만 찍고, 시간과 에너지를 낭비한 적 있으시죠?' },
    { emoji: '🔍', title: '취미 친구 구하기', desc: '보드게임, 등산, 독서... 같은 취미를 즐기는 사람을 주변에서 찾기 어려워요.' },
  ]

  const solutions = [
    { icon: '🤖', title: 'AI 취향 매칭', desc: '당신의 관심사와 성향을 분석해서 딱 맞는 모임을 추천해 드려요.' },
    { icon: '🌳', title: '소규모 모임', desc: '2명에서 최대 100명까지! 다양한 친구들과 대화하고, 활동을 즐길 수 있어요.' },
    { icon: '❤️', title: '매너 시스템', desc: '매너도와 리뷰로 서로 신뢰할 수 있는 건강한 커뮤니티를 만들어요.' },
    { icon: '🎯', title: '간편한 일정 관리', desc: '모임 생성부터 일정 조율, 참석 확인까지 한 곳에서 해결해요.' },
  ]

  const steps = [
    { num: 1, title: '프로필 작성', desc: '관심사와 간단한 자기소개를 입력하세요.' },
    { num: 2, title: 'AI 추천 받기', desc: 'AI가 당신의 취향에 맞는 모임을 찾아드려요.' },
    { num: 3, title: '함께 놀기', desc: '마음에 드는 모임에 참여하고 새 친구를 만나세요!' },
  ]

  /* ─── 타임라인 카운터 ─── */
  const counter1 = useCountUp(1, 800)
  const counter2 = useCountUp(2, 800)
  const counter3 = useCountUp(3, 800)
  const counters = [counter1, counter2, counter3]

  const [showSupportPopup, setShowSupportPopup] = useState(false)

  return (
    <div style={{ position: 'relative', overflowX: 'hidden' }}>

      {/* ─── 상단 네비게이션 ─── */}
      <div style={{
        position: 'fixed',
        top: '12px',
        right: '20px',
        zIndex: 99,
        display: 'flex',
        gap: '8px',
      }}>
        <button
          onClick={() => navigate(user ? '/gatherings' : '/login')}
          style={{
            padding: '8px 18px',
            background: 'var(--button-primary)',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#fff',
            cursor: 'pointer',
            outline: 'none',
            transition: 'background 0.2s, transform 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--button-primary-hover)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--button-primary)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          로그인
        </button>
        {!user && (
          <button
            onClick={() => { enterGuestMode(); navigate('/gatherings'); }}
            style={{
              padding: '8px 18px',
              background: 'rgba(255,255,255,0.25)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.4)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.25)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            둘러보기
          </button>
        )}
        <button
          onClick={() => setShowSupportPopup(true)}
          style={{
            padding: '8px 18px',
            background: 'rgba(255,255,255,0.25)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            outline: 'none',
            transition: 'background 0.2s, transform 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.4)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.25)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          고객센터
        </button>
      </div>

      {/* ─── 고객센터 팝업 ─── */}
      {showSupportPopup && (
        <div
          onClick={() => setShowSupportPopup(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.6)',
              borderRadius: '24px',
              padding: '40px 48px',
              textAlign: 'center',
              boxShadow: '0 16px 64px rgba(0,0,0,0.15)',
              animation: 'scaleReveal 0.3s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛠️</div>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '800',
              color: 'var(--text-primary)',
              marginBottom: '8px',
            }}>
              준비 중입니다
            </h3>
            <p style={{
              fontSize: '15px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: '28px',
            }}>
              고객센터 페이지는 현재 준비 중이에요.<br />조금만 기다려 주세요!
            </p>
            <button
              onClick={() => setShowSupportPopup(false)}
              style={{
                padding: '10px 28px',
                background: 'var(--button-primary)',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                color: '#fff',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ─── 스크롤 프로그레스 바 ─── */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '3px',
        width: `${scrollProgress * 100}%`,
        background: 'linear-gradient(90deg, var(--button-primary), #5A7A6D, #8fa894)',
        zIndex: 100,
        transition: 'width 0.1s linear',
      }} />

      {/* ─── 오로라 배경 ─── */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0,
        background: 'linear-gradient(135deg, #8fa894, #9eb39e 50%, #a3b8a2)',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          width: '70%', height: '70%',
          top: '0%', left: '0%',
          background: 'radial-gradient(circle at center, rgba(70,114,98,0.75), transparent 68%)',
          filter: 'blur(55px)',
          animation: 'auroraBlob1 6s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          width: '65%', height: '65%',
          top: '25%', right: '0%',
          background: 'radial-gradient(circle at center, rgba(197,216,157,0.65), transparent 68%)',
          filter: 'blur(65px)',
          animation: 'auroraBlob2 8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          width: '120%', height: '90%',
          top: '5%', left: '-10%',
          background: 'radial-gradient(ellipse at center, rgba(254,249,150,0.55), transparent 65%)',
          filter: 'blur(80px)',
          animation: 'auroraBlob3 7s ease-in-out infinite',
        }} />
      </div>

      {/* ─── 오로라 텍스처 오버레이 (SVG 노이즈) ─── */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0,
        opacity: 0.03,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}>
        <svg width="100%" height="100%">
          <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>
      </div>

      {/* ─── 콘텐츠 ─── */}
      <div style={{ position: 'relative', zIndex: 1 }}>


        {/* ═══════════════ 섹션 1: Hero ═══════════════ */}
        <section style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: sectionPadding,
          textAlign: 'center',
        }}>
          {/* 트리 아이콘 */}
          <div style={{
            animation: 'heroTextReveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s both, float 6s ease-in-out infinite',
            marginBottom: '28px',
          }}>
            <span style={{ fontSize: isMobile ? '64px' : '88px' }}>🌳</span>
          </div>

          {/* 메인 카피 — 글래스 패널 */}
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(255,255,255,0.3))',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: isMobile ? '28px' : '36px',
            padding: isMobile ? '36px 28px' : '56px 68px',
            maxWidth: isMobile ? '100%' : '720px',
            width: '100%',
            marginBottom: '32px',
            boxShadow: '0 8px 48px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
            animation: 'heroTextReveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.6s both',
          }}>
            {/* BorderBeam */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              padding: '2px',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: '250%', height: '250%',
                background: 'conic-gradient(transparent 0deg, rgba(197,216,157,0.5) 40deg, rgba(255,255,255,0.95) 60deg, rgba(197,216,157,0.5) 80deg, transparent 120deg)',
                animation: 'borderBeamRotate 6s linear infinite',
                animationDelay: '0s',
              }} />
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: '250%', height: '250%',
                background: 'conic-gradient(transparent 0deg, rgba(197,216,157,0.5) 40deg, rgba(255,255,255,0.95) 60deg, rgba(197,216,157,0.5) 80deg, transparent 120deg)',
                animation: 'borderBeamRotate 6s linear infinite',
                animationDelay: '-3s',
              }} />
            </div>

            <p style={{
              fontSize: isMobile ? '13px' : '15px',
              color: 'var(--button-primary)',
              marginBottom: '14px',
              fontWeight: '700',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              animation: 'heroTextReveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.8s both',
            }}>
              어른들의 순수한 놀이터
            </p>
            <h1 style={{
              fontSize: isMobile ? '48px' : '72px',
              fontWeight: '900',
              marginBottom: '20px',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #2D3A2E 0%, #4a7060 40%, #6B9080 60%, #2D3A2E 100%)',
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'heroTextReveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.9s both, gradientShimmer 4s ease infinite',
            }}>
              나무 놀이터
            </h1>
            <p style={{
              fontSize: isMobile ? '16px' : '20px',
              color: 'var(--text-secondary)',
              lineHeight: 1.75,
              animation: 'heroTextReveal 0.7s cubic-bezier(0.16,1,0.3,1) 1.0s both',
            }}>
              AI가 당신의 취향을 분석하고,<br />
              딱 맞는 사람들과 함께할 모임을 찾아드려요.
            </p>
          </div>

          {/* CTA 버튼 */}
          <div style={{ animation: 'heroTextReveal 0.7s cubic-bezier(0.16,1,0.3,1) 1.1s both' }}>
            {ctaButton}
          </div>

          {/* 둘러보기 버튼 */}
          {!user && (
            <div style={{ animation: 'heroTextReveal 0.7s cubic-bezier(0.16,1,0.3,1) 1.2s both', marginTop: '12px' }}>
              <button
                onClick={() => { enterGuestMode(); navigate('/gatherings'); }}
                style={{
                  padding: isMobile ? '14px 32px' : '16px 44px',
                  background: 'rgba(255,255,255,0.25)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1.5px solid rgba(255,255,255,0.5)',
                  borderRadius: '16px',
                  fontSize: isMobile ? '15px' : '17px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.4)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.25)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                로그인 없이 둘러보기
              </button>
            </div>
          )}

          {/* 스크롤 힌트 */}
          <ScrollHint onClick={scrollToProblems} animationDelay="1.3s" />
        </section>

        {/* ═══════════════ 섹션 2: 문제 제시 ═══════════════ */}
        <section ref={problemsRef} style={{ padding: sectionPadding, maxWidth: '1040px', margin: '0 auto' }}>
          <SectionHeader headingSize={headingSize}>
            이런 고민 있으셨나요?
          </SectionHeader>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? '20px' : '28px',
          }}>
            {problems.map((p, i) => (
              <GlassCard
                key={i}
                index={i}
                isMobile={isMobile}
                animation={isMobile ? (i % 2 === 0 ? 'slideInLeft' : 'slideInRight') : 'cardReveal'}
                delay={`${i * 0.15}s`}
              >
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>{p.emoji}</div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
                  {p.title}
                </h3>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {p.desc}
                </p>
              </GlassCard>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '60px' }}>
            <ScrollHint onClick={() => solutionsRef.current?.scrollIntoView({ behavior: 'smooth' })} />
          </div>
        </section>

        {/* ═══════════════ 섹션 3: 솔루션 ═══════════════ */}
        <section ref={solutionsRef} style={{ padding: sectionPadding, maxWidth: '1040px', margin: '0 auto' }}>
          <SectionHeader headingSize={headingSize}>
            나무놀이터가 다른 이유
          </SectionHeader>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: isMobile ? '20px' : '28px',
          }}>
            {solutions.map((s, i) => (
              <GlassCard
                key={i}
                index={i}
                isMobile={isMobile}
                animation="scaleReveal"
                delay={`${i * 0.1}s`}
                style={!isMobile && (i === 0 || i === 2) ? { marginTop: '70px' } : undefined}
              >
                <SolutionCardContent icon={s.icon} title={s.title} desc={s.desc} isMobile={isMobile} />
              </GlassCard>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '60px' }}>
            <ScrollHint onClick={() => timelineRef.current?.scrollIntoView({ behavior: 'smooth' })} />
          </div>
        </section>

        {/* ═══════════════ 섹션 4: 사용 방법 (타임라인) ═══════════════ */}
        <section ref={timelineRef} style={{ padding: sectionPadding, maxWidth: '720px', margin: '0 auto' }}>
          <SectionHeader headingSize={headingSize}>
            3분이면 같이 놀 친구를<br />찾을 수 있어요
          </SectionHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {steps.map((step, i) => (
              <RevealSection
                key={i}
                animation="slideInRight"
                delay={`${i * 0.2}s`}
              >
                <div style={{
                  display: 'flex',
                  gap: isMobile ? '20px' : '28px',
                  alignItems: 'flex-start',
                  position: 'relative',
                  paddingBottom: i < steps.length - 1 ? '48px' : '0',
                }}>
                  {/* 타임라인 연결선 */}
                  {i < steps.length - 1 && (
                    <div style={{
                      position: 'absolute',
                      left: isMobile ? '25px' : '29px',
                      top: isMobile ? '52px' : '60px',
                      bottom: '0',
                      width: '2px',
                      background: 'linear-gradient(to bottom, rgba(107,144,128,0.4), rgba(107,144,128,0.1))',
                      transformOrigin: 'top',
                      animation: `lineGrow 0.8s cubic-bezier(0.16,1,0.3,1) ${0.3 + i * 0.2}s both`,
                    }} />
                  )}
                  {/* 숫자 원 */}
                  <div
                    ref={counters[i].ref}
                    style={{
                      width: isMobile ? '52px' : '60px',
                      height: isMobile ? '52px' : '60px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--button-primary), #5A7A6D)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? '22px' : '26px',
                      fontWeight: '800',
                      flexShrink: 0,
                      boxShadow: '0 4px 16px rgba(107,144,128,0.3), 0 0 0 4px rgba(107,144,128,0.15)',
                      animation: `numberPop 0.6s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.2}s both`,
                    }}
                  >
                    {counters[i].value}
                  </div>
                  {/* 내용 */}
                  <div style={{ paddingTop: isMobile ? '6px' : '10px' }}>
                    <h3 style={{
                      fontSize: subHeadingSize,
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      marginBottom: '8px',
                    }}>
                      {step.title}
                    </h3>
                    <p style={{ fontSize: bodySize, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '60px' }}>
            <ScrollHint onClick={() => ctaRef.current?.scrollIntoView({ behavior: 'smooth' })} />
          </div>
        </section>

        {/* ═══════════════ 섹션 5: 최종 CTA ═══════════════ */}
        <section ref={ctaRef} style={{
          padding: isMobile ? '100px 20px' : '160px 40px',
          textAlign: 'center',
        }}>
          <RevealSection animation="scaleReveal">
            {/* 글래스 패널 배경 */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.15))',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '32px',
              padding: isMobile ? '48px 28px' : '72px 64px',
              maxWidth: '640px',
              margin: '0 auto',
              boxShadow: '0 8px 48px rgba(0,0,0,0.06)',
            }}>
              <h2 style={{
                fontSize: headingSize,
                fontWeight: '800',
                color: 'var(--text-primary)',
                marginBottom: '16px',
                letterSpacing: '-0.02em',
              }}>
                지금 바로 시작해 보세요
              </h2>
              <p style={{
                fontSize: bodySize,
                color: 'var(--text-secondary)',
                marginBottom: '40px',
                lineHeight: 1.7,
              }}>
                같은 취미, 같은 관심사를 가진 사람들이 기다리고 있어요.
              </p>
              {ctaButton}
            </div>
          </RevealSection>
        </section>

        {/* ═══════════════ 푸터 ═══════════════ */}
        <footer style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px',
          borderTop: '1px solid rgba(255,255,255,0.2)',
        }}>
          🌳 © 2025 나무 놀이터. All rights reserved.
        </footer>
      </div>
    </div>
  )
}

/* ─── ScrollHint ─── */
function ScrollHint({ onClick, animationDelay = '0s' }) {
  return (
    <button
      onClick={onClick}
      style={{
        marginTop: animationDelay !== '0s' ? '52px' : '0',
        animation: animationDelay !== '0s'
          ? `heroTextReveal 0.7s cubic-bezier(0.16,1,0.3,1) ${animationDelay} both`
          : undefined,
        color: 'var(--text-muted)',
        fontSize: '12px',
        background: 'none',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        padding: '8px',
        transition: 'color 0.3s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}
      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
    >
      <span style={{ letterSpacing: '0.2em', fontWeight: '600', textTransform: 'uppercase' }}>SCROLL</span>
      <svg
        width="24" height="24" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ animation: 'scrollBounce 2s ease-in-out infinite' }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  )
}

/* ─── SolutionCardContent (extracted for readability) ─── */
function SolutionCardContent({ icon, title, desc, isMobile }) {
  const [iconHovered, setIconHovered] = useState(false)

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: isMobile ? 'flex-start' : 'center' }}>
      <div
        style={{
          fontSize: '36px',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '16px',
          background: 'rgba(107,144,128,0.1)',
          border: '1px solid rgba(107,144,128,0.15)',
          flexShrink: 0,
          transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
          transform: iconHovered ? 'scale(1.08) rotate(-3deg)' : 'scale(1) rotate(0deg)',
          cursor: 'default',
        }}
        onMouseEnter={() => setIconHovered(true)}
        onMouseLeave={() => setIconHovered(false)}
      >
        {icon}
      </div>
      <div>
        <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
          {title}
        </h3>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {desc}
        </p>
      </div>
    </div>
  )
}
