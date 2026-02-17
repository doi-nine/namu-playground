import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log('Webhook 받음:', payload)

    // 이벤트 타입별 처리
    if (payload.type === 'subscription.created' || payload.type === 'subscription.active') {
      const userId = payload.data.metadata?.user_id
      
      if (!userId) {
        throw new Error('user_id가 메타데이터에 없습니다')
      }

      // 프리미엄 활성화
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 1) // 1개월 후

      const { error } = await supabase
        .from('profiles')
        .update({
          is_premium: true,
          premium_expires_at: expiresAt.toISOString(),
          ai_recommendations_left: 999999, // 프리미엄은 사실상 무제한
        })
        .eq('id', userId)

      if (error) {
        console.error('프로필 업데이트 실패:', error)
        throw error
      }

      console.log(`프리미엄 활성화 완료: ${userId}`)
    }

    // 구독 취소 또는 만료
    if (payload.type === 'subscription.canceled' || payload.type === 'subscription.revoked') {
      const userId = payload.data.metadata?.user_id
      
      if (userId) {
        const { error } = await supabase
          .from('profiles')
          .update({
            is_premium: false,
            premium_expires_at: null,
            ai_recommendations_left: 3, // 무료 사용자는 3회
          })
          .eq('id', userId)

        if (error) {
          console.error('프리미엄 해지 실패:', error)
        } else {
          console.log(`프리미엄 해지 완료: ${userId}`)
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Webhook 처리 오류:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})