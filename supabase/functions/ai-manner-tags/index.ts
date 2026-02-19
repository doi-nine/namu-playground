import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TAG_DEFINITIONS = [
  { tag_type: 'punctual', tag_label: '약속을 잘 지켜요', icon: '⏰' },
  { tag_type: 'organizer', tag_label: '모임을 자주 열어요', icon: '🏠' },
  { tag_type: 'veteran', tag_label: '오래 활동중인 멤버예요', icon: '🌱' },
  { tag_type: 'communicator', tag_label: '활발한 소통러예요', icon: '💬' },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 유저 인증
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('인증되지 않은 사용자')

    // service role 클라이언트 (RLS 우회)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 쿨다운 체크 (1시간)
    const { data: analysisLog } = await supabaseAdmin
      .from('ai_manner_analysis_log')
      .select('last_analyzed_at')
      .eq('user_id', user.id)
      .eq('analysis_type', 'tags')
      .maybeSingle()

    if (analysisLog) {
      const lastAnalyzed = new Date(analysisLog.last_analyzed_at)
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
      if (lastAnalyzed > hourAgo) {
        // 쿨다운 중 - 현재 태그만 반환
        const { data: currentTags } = await supabaseAdmin
          .from('ai_manner_tags')
          .select('tag_type, tag_label, assigned_at')
          .eq('user_id', user.id)

        return new Response(
          JSON.stringify({ tags: currentTags || [], cooldown: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 4개 조건 병렬 쿼리
    const [punctualResult, organizerResult, veteranResult, communicatorResult] = await Promise.all([
      // punctual: completed schedule 참여 5회 이상 AND 불참 0회
      (async () => {
        const { data: participations } = await supabaseAdmin
          .from('schedule_participants')
          .select('schedule_id, attendance_status, schedules!inner(is_completed)')
          .eq('user_id', user.id)
          .eq('schedules.is_completed', true)

        const completed = participations || []
        const confirmedCount = completed.filter(p => p.attendance_status === 'confirmed').length
        const pendingCount = completed.filter(p => p.attendance_status === 'pending').length
        return confirmedCount >= 5 && pendingCount === 0
      })(),

      // organizer: gatherings에서 creator_id = user_id 3개 이상
      (async () => {
        const { count } = await supabaseAdmin
          .from('gatherings')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', user.id)

        return (count || 0) >= 3
      })(),

      // veteran: profiles.created_at으로부터 30일 이상 경과
      (async () => {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('created_at')
          .eq('id', user.id)
          .maybeSingle()

        if (!profile) return false
        const createdAt = new Date(profile.created_at)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        return createdAt <= thirtyDaysAgo
      })(),

      // communicator: messages + schedule_messages 합산 50개 이상
      (async () => {
        const [{ count: msgCount }, { count: schMsgCount }] = await Promise.all([
          supabaseAdmin
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabaseAdmin
            .from('schedule_messages')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ])

        return ((msgCount || 0) + (schMsgCount || 0)) >= 50
      })(),
    ])

    const conditions = [punctualResult, organizerResult, veteranResult, communicatorResult]

    // 태그 upsert/delete
    for (let i = 0; i < TAG_DEFINITIONS.length; i++) {
      const { tag_type, tag_label } = TAG_DEFINITIONS[i]
      const qualified = conditions[i]

      if (qualified) {
        await supabaseAdmin
          .from('ai_manner_tags')
          .upsert(
            { user_id: user.id, tag_type, tag_label, assigned_at: new Date().toISOString() },
            { onConflict: 'user_id,tag_type' }
          )
      } else {
        await supabaseAdmin
          .from('ai_manner_tags')
          .delete()
          .eq('user_id', user.id)
          .eq('tag_type', tag_type)
      }
    }

    // analysis_log upsert
    await supabaseAdmin
      .from('ai_manner_analysis_log')
      .upsert(
        { user_id: user.id, analysis_type: 'tags', last_analyzed_at: new Date().toISOString() },
        { onConflict: 'user_id,analysis_type' }
      )

    // 최종 태그 반환
    const { data: finalTags } = await supabaseAdmin
      .from('ai_manner_tags')
      .select('tag_type, tag_label, assigned_at')
      .eq('user_id', user.id)

    return new Response(
      JSON.stringify({ tags: finalTags || [], cooldown: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('AI 매너 태그 분석 오류:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
