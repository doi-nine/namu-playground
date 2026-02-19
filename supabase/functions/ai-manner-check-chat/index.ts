import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // service role 클라이언트
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 쿨다운 체크 (24시간)
    const { data: analysisLog } = await supabaseAdmin
      .from('ai_manner_analysis_log')
      .select('last_analyzed_at')
      .eq('user_id', user.id)
      .eq('analysis_type', 'chat_rudeness')
      .maybeSingle()

    if (analysisLog) {
      const lastAnalyzed = new Date(analysisLog.last_analyzed_at)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      if (lastAnalyzed > dayAgo) {
        return new Response(
          JSON.stringify({ checked: false, cooldown: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const warnings: string[] = []

    // === 노쇼 경고 (DB 쿼리) ===
    const { data: participations } = await supabaseAdmin
      .from('schedule_participants')
      .select('attendance_status, schedules!inner(is_completed)')
      .eq('user_id', user.id)
      .eq('schedules.is_completed', true)

    const noShowCount = (participations || []).filter(
      p => p.attendance_status !== 'confirmed'
    ).length

    if (noShowCount >= 2) {
      // 최근 30일 내 같은 유형 경고 있는지 확인
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentNoShowWarning } = await supabaseAdmin
        .from('ai_manner_warnings')
        .select('id')
        .eq('user_id', user.id)
        .eq('warning_type', 'no_show')
        .gte('created_at', thirtyDaysAgo)
        .limit(1)

      if (!recentNoShowWarning || recentNoShowWarning.length === 0) {
        await supabaseAdmin
          .from('ai_manner_warnings')
          .insert({
            user_id: user.id,
            warning_type: 'no_show',
            warning_message: '완료된 일정에 2회 이상 불참하셨어요. 참여가 어려운 경우 미리 알려주시면 좋겠어요.',
          })
        warnings.push('no_show')
      }
    }

    // === 채팅 비매너 경고 (GPT) ===
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // messages + schedule_messages에서 최근 7일 메시지 조회
    const [{ data: chatMessages }, { data: scheduleMessages }] = await Promise.all([
      supabaseAdmin
        .from('messages')
        .select('content, created_at')
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(15),
      supabaseAdmin
        .from('schedule_messages')
        .select('content, created_at')
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    const allMessages = [
      ...(chatMessages || []),
      ...(scheduleMessages || []),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 30)

    if (allMessages.length >= 5) {
      const apiKey = Deno.env.get('OPENAI_API_KEY')
      if (apiKey) {
        const chatContent = allMessages.map(m => m.content).join('\n')

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `당신은 한국어 게임 커뮤니티 채팅 모더레이터입니다.
아래 메시지 목록을 분석하여 욕설, 비하 표현, 공격적 표현이 있는지 판단하세요.
가벼운 인터넷 슬랭(ㅋㅋ, ㅎㅎ, ㄱㄱ 등)은 비매너가 아닙니다.
명확한 욕설, 인신공격, 혐오 표현만 비매너로 판단하세요.

반드시 JSON 형식으로만 응답하세요:
{"is_rude": boolean, "reason": string | null}`
              },
              {
                role: 'user',
                content: chatContent
              }
            ],
            temperature: 0.2,
            max_tokens: 200,
            response_format: { type: 'json_object' }
          })
        })

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json()
          let result
          try {
            result = JSON.parse(openaiData.choices[0].message.content)
          } catch {
            result = { is_rude: false, reason: null }
          }

          if (result.is_rude) {
            // 최근 7일 내 같은 유형 경고 있는지 확인
            const { data: recentChatWarning } = await supabaseAdmin
              .from('ai_manner_warnings')
              .select('id')
              .eq('user_id', user.id)
              .eq('warning_type', 'chat_rudeness')
              .gte('created_at', sevenDaysAgo)
              .limit(1)

            if (!recentChatWarning || recentChatWarning.length === 0) {
              await supabaseAdmin
                .from('ai_manner_warnings')
                .insert({
                  user_id: user.id,
                  warning_type: 'chat_rudeness',
                  warning_message: 'AI가 최근 채팅에서 부적절한 표현을 감지했어요. 서로 존중하는 대화를 부탁드려요.',
                })
              warnings.push('chat_rudeness')
            }
          }
        }
      }
    }

    // analysis_log upsert
    await supabaseAdmin
      .from('ai_manner_analysis_log')
      .upsert(
        { user_id: user.id, analysis_type: 'chat_rudeness', last_analyzed_at: new Date().toISOString() },
        { onConflict: 'user_id,analysis_type' }
      )

    return new Response(
      JSON.stringify({ checked: true, warnings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('AI 매너 경고 분석 오류:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
