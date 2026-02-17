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
    const { prompt, gathering } = await req.json()

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
            content: `너는 게임 모임 모집글을 대신 써주는 도우미야.

## 규칙 (반드시 지켜)
1. 이모지 절대 쓰지 마
2. "신나는", "특별한", "열정적인", "함께해요!", "놓치지 마세요", "추억을 만들어봅시다" 같은 뻔한 광고 표현 금지
3. 설명은 2~3문장. 필요한 정보만 담담하게 전달
4. 반말 기본. "~할 사람", "~하려고", "~있으면 와" 같은 자연스러운 구어체
5. 뭘 하는지, 어떤 분위기인지, 누구를 원하는지만 써
6. 제목은 15자 이내, 핵심만

## 좋은 예시
{"title": "할리갈리 한판 칠 사람", "description": "토요일 오후에 보드게임카페에서 할리갈리 할 예정입니다. 초보도 상관없고 가볍게 몇 판 치다 갈 사람이면 됩니다. 유혈사태가 발생하지 않게 손톱을 깎고 오셔야 합니다."}
{"title": "롤 듀오 구함", "description": "골드~플래티넘 서포터 구합니다. 평일 밤 10시 이후에 2~3판 정도 돌릴 사람이면 좋습니다. 티어 안 올라도 욕 안 하는 사람이라면 완벽합니다."}
{"title": "방탈출 같이 갈 사람", "description": "강남 쪽 방탈출 가려는데 2명 모자라요. 난이도 중상 이상 도전하고 싶고, 금요일 저녁 7시쯤 가능한 사람 연락주세요."}

## 나쁜 예시 (이렇게 쓰면 안 됨)
- "🌟 특별한 보드게임 모임이 열립니다!"
- "함께 신나는 시간을 보내며 즐거운 추억을 만들어봅시다!"
- "여러분의 열정적인 플레이를 기다리고 있어요! 🎊"

응답은 반드시 JSON으로만. 다른 텍스트 없이:
{"title": "제목", "description": "설명"}`
          },
          {
            role: 'user',
            content: `${gathering ? `기존 모임 정보:\n- 제목: ${gathering.title}\n- 설명: ${gathering.description}\n- 카테고리: ${gathering.category || '없음'}\n\n` : ''}사용자 요청:\n${prompt}`
          }
        ],
        temperature: 0.6,
        max_tokens: 1000,
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
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('AI 글 생성 오류:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  }
})
