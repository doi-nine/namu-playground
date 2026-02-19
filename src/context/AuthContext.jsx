import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(() => sessionStorage.getItem('guestMode') === 'true')

  useEffect(() => {
    // 초기 사용자 정보 가져오기
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        fetchProfile(data.user.id)
      } else {
        setLoading(false)
      }
    })

    // 인증 상태 변경 감지
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          setLoading(true)
          fetchProfile(session.user.id)
          // 실제 로그인 시 게스트 모드 자동 해제
          sessionStorage.removeItem('guestMode')
          setIsGuest(false)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const fetchProfile = async (userId) => {
    console.log('🔍 프로필 로드 시작:', userId)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle() // ← single() 대신 maybeSingle() 사용

      console.log('📦 프로필 데이터:', data)
      console.log('❌ 프로필 에러:', error)

      if (error) {
        console.log('⚠️ 프로필 로드 에러:', error.message)
        setProfile(null)
      } else if (!data) {
        console.log('⚠️ 프로필 없음 - 신규 가입자')
        setProfile(null)
      } else {
        console.log('✅ 프로필 로드 성공')
        setProfile(data)
      }
    } catch (err) {
      console.error('💥 프로필 로드 예외:', err)
      setProfile(null)
    } finally {
      console.log('🏁 로딩 완료')
      setLoading(false)
    }
  }

  const signUp = (email, password) =>
    supabase.auth.signUp({ email, password })

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/gatherings`,
      },
    })

  const signOut = () => supabase.auth.signOut()

  const enterGuestMode = () => {
    sessionStorage.setItem('guestMode', 'true')
    setIsGuest(true)
  }

  const exitGuestMode = () => {
    sessionStorage.removeItem('guestMode')
    setIsGuest(false)
  }

  // ✅ 프로필 새로고침 함수 추가
  const refreshProfile = async () => {
    if (!user) return;

    console.log('🔄 프로필 새로고침 시작');
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      console.log('✅ 프로필 새로고침 완료');
      setProfile(data);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      refreshProfile,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      isGuest,
      enterGuestMode,
      exitGuestMode
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext)
}