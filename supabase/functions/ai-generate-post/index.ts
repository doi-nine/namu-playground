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
    const { prompt, tone = '중립적' } = await req.json()

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

    const toneDesc = tone === '부드럽게' ? '친근하고 따뜻한' : tone === '중립적' ? '격식 있고 명료한' : '단호하고 간결한'

    const systemPrompt = `당신은 게임 소모임 게시판 글을 작성하는 전문가입니다.
사용자가 키워드나 짧은 문장으로 입력한 내용을 자연스러운 게시글로 변환해주세요.

작성 규칙:
1. ${toneDesc} 톤을 사용하세요
2. 이모지는 사용하지 마세요
3. 반드시 JSON 형식으로만 출력하세요: {"content": "게시글 내용(200자 이내)"}
4. 게임 모임 커뮤니티의 맥락에 맞게 자연스럽게 작성하세요
5. 내용은 핵심만 담고, 대화체로 편안하게 작성하세요
6. 줄바꿈을 적절히 사용해 가독성을 높이세요

입력 예시: "오늘 보드게임 너무 재밌었다, 다음에도 하고 싶다"
출력 예시:
{"content": "오늘 보드게임 정말 재밌었습니다!\\n다음에도 꼭 함께하고 싶네요. 참여해주신 분들 모두 고생하셨습니다."}`

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
        temperature: 0.7,
        max_tokens: 500,
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
    console.error('AI 게시글 생성 오류:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
