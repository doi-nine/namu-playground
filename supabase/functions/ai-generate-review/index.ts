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
    const { schedule_title, q1_mood, q2_again, q3_oneliner } = await req.json()

    if (!q1_mood || !q2_again || !q3_oneliner) {
      return new Response(
        JSON.stringify({ error: '모든 문항에 답변해주세요.' }),
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

    const systemPrompt = `당신은 모임 일정 후기를 요약하는 전문가입니다.
사용자의 3가지 답변을 바탕으로 자연스러운 1~2문장의 후기 요약문을 작성해주세요.

작성 규칙:
1. 친근하고 따뜻한 톤을 사용하세요
2. 이모지는 사용하지 마세요
3. 반드시 JSON 형식으로만 출력하세요: {"summary": "요약문"}
4. 1~2문장으로 간결하게 작성하세요
5. 답변의 감정과 뉘앙스를 자연스럽게 반영하세요`

    const userMessage = `일정: ${schedule_title || '모임 일정'}
분위기: ${q1_mood}
재참여 의향: ${q2_again}
한 줄 소감: ${q3_oneliner}`

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
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 300,
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
    console.error('AI 후기 요약 생성 오류:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
