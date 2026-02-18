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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('인증되지 않은 사용자')

    const { gathering_id, messages } = await req.json()

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: '요약할 메시지가 없습니다' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 프로필에서 프리미엄 여부 및 잔여 횟수 확인
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_premium, ai_chat_summary_left')
      .eq('id', user.id)
      .single()

    if (!profile) throw new Error('프로필을 찾을 수 없습니다')

    const summaryLeft = profile.ai_chat_summary_left ?? 3

    if (!profile.is_premium && summaryLeft <= 0) {
      return new Response(
        JSON.stringify({ error: '이번 달 무료 채팅 요약 횟수를 모두 사용했습니다. 프리미엄으로 업그레이드하면 무제한으로 이용할 수 있어요!' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // OpenAI API 호출
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY가 설정되지 않았습니다' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 메시지를 대화 형식으로 포맷
    const chatLog = messages
      .map((m: { nickname: string; content: string; time: string }) => `[${m.time}] ${m.nickname}: ${m.content}`)
      .join('\n')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `당신은 모임 채팅 요약 전문가입니다. 채팅 내용을 시간순이 아닌 주제별로 묶어서 요약해주세요.

규칙:
1. 대화에서 반복되거나 연관된 내용을 같은 주제로 묶기
2. 각 주제는 "▸ 주제명" 형식의 헤더로 시작
3. 헤더 아래에 해당 주제의 핵심 내용을 글머리 기호(•)로 정리
4. 불필요한 인사말이나 잡담은 생략
5. 한국어로 작성, 자연스러운 문체
6. 주제는 최대 5개, 각 주제당 항목은 최대 5개

출력 예시:
▸ 모임 일정
• 이번 주 토요일 오후 3시로 확정
• 장소는 강남역 근처 카페

▸ 참가 인원
• 총 5명 참가 예정`
          },
          {
            role: 'user',
            content: `다음 모임 채팅 내용을 요약해주세요:\n\n${chatLog}`
          }
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API 오류:', response.status, errorText)
      return new Response(
        JSON.stringify({ error: `AI 요약 생성 실패 (${response.status})` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const data = await response.json()
    const summary = data.choices[0].message.content

    // 무료 유저 횟수 차감
    if (!profile.is_premium) {
      await supabaseClient
        .from('profiles')
        .update({ ai_chat_summary_left: Math.max(0, summaryLeft - 1) })
        .eq('id', user.id)
    }

    return new Response(
      JSON.stringify({
        summary,
        remaining: profile.is_premium ? null : Math.max(0, summaryLeft - 1)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})