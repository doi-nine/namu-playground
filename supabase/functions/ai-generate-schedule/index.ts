import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, currentDate } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: '내용을 입력해주세요.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API 키가 설정되지 않았습니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const today = currentDate || new Date().toISOString().slice(0, 10)

    const systemPrompt = `당신은 게임 소모임 일정을 작성하는 전문가입니다.
사용자가 키워드나 짧은 문장으로 입력한 내용을 자연스러운 일정 제목과 설명으로 변환해주세요.
오늘 날짜는 ${today}입니다.

작성 규칙:
1. 친근하고 명확한 톤을 사용하세요
2. 이모지는 사용하지 마세요
3. 반드시 JSON 형식으로만 출력하세요: {"title": "제목(20자 이내)", "description": "설명(150자 이내)", "datetime": "YYYY-MM-DDTHH:mm 또는 null"}
4. 게임 모임 일정의 맥락(보드게임, 비디오게임, 카드게임 등)에 맞게 작성하세요
5. 제목은 일정의 핵심을 간결하게, 설명은 참여자가 알아야 할 내용을 자연스럽게 담으세요
6. datetime 규칙:
   - 입력에 날짜/시간 정보가 있으면 오늘(${today}) 기준으로 계산해 "YYYY-MM-DDTHH:mm" 형식으로 반환
   - "토요일" → 오늘 이후 가장 가까운 토요일
   - "다음 주 금요일" → 다음 주 금요일
   - 시간이 없으면 18:00으로 기본값
   - 날짜/시간 정보가 전혀 없으면 null

입력 예시: "토요일 오후 3시 카탄 보드게임, 초보 환영"
출력 예시:
{"title": "카탄 보드게임 - 초보 환영", "description": "이번 주 토요일 오후 3시에 카탄을 함께 즐길 분들을 모집합니다. 처음 해보시는 분도 룰 설명해드리니 부담 없이 참여하세요.", "datetime": "2026-02-21T15:00"}`

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 400,
        response_format: { type: 'json_object' }
      })
    })

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text()
      console.error('OpenAI API 오류:', openaiResponse.status, errBody)
      return new Response(
        JSON.stringify({ error: `OpenAI API 오류 (${openaiResponse.status})` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const openaiData = await openaiResponse.json()
    const aiResponse = openaiData.choices[0].message.content

    let parsedResponse
    try {
      parsedResponse = JSON.parse(aiResponse)
    } catch {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0])
      } else {
        return new Response(
          JSON.stringify({ error: 'AI 응답을 파싱할 수 없습니다' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    return new Response(
      JSON.stringify(parsedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('AI 일정 생성 오류:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
