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
    const { profile, gatherings } = await req.json()

    if (!profile || !gatherings || gatherings.length === 0) {
      return new Response(
        JSON.stringify({ recommendations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // OpenAI API 호출
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 게임 모임 추천 전문가입니다. 사용자 프로필과 실제 모임 목록을 분석하여, 목록에 있는 실제 모임 중에서만 가장 적합한 모임을 추천해주세요.'
          },
          {
            role: 'user',
            content: `
사용자 프로필:
- 선호 게임: ${profile.favorite_game_categories?.join(', ') || '없음'}
- 지역: ${profile.location || '없음'}
- 최애 게임: ${profile.favorite_game_title || '없음'}
- 자기소개: ${profile.bio || '없음'}

실제 모임 목록 (반드시 이 목록에서만 선택하세요):
${gatherings.map((g, i) => `
${i + 1}번 모임:
- ID: ${g.id}
- 제목: ${g.title}
- 카테고리: ${g.category}
- 날짜: ${new Date(g.datetime).toLocaleDateString('ko-KR')}
- 장소: ${g.location || g.online_platform || '미정'}
- 설명: ${g.description?.substring(0, 100) || '없음'}
`).join('\n')}

위 실제 모임 목록에서 사용자에게 가장 적합한 모임 최대 5개를 선택하고,
각 모임의 정확한 ID와 추천 이유를 JSON 형식으로 반환하세요.

⚠️ 중요: 반드시 위 목록에 있는 모임의 정확한 ID만 사용하세요. 새로운 모임을 만들지 마세요.

응답 형식:
{
  "recommendations": [
    {
      "gathering_id": "실제_모임의_정확한_UUID",
      "reason": "간단한 추천 이유 (한 문장)"
    }
  ]
}
`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    })

    if (!openaiResponse.ok) {
      throw new Error('OpenAI API 호출 실패')
    }

    const openaiData = await openaiResponse.json()
    const aiResponse = openaiData.choices[0].message.content

    // JSON 파싱
    let parsedResponse
    try {
      parsedResponse = JSON.parse(aiResponse)
    } catch {
      // JSON이 코드 블록 안에 있을 수 있음
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('AI 응답을 파싱할 수 없습니다')
      }
    }

    // 추천된 모임 ID로 실제 데이터 가져오기
    const recommendedIds = parsedResponse.recommendations.map(r => r.gathering_id)
    const recommendationsWithData = parsedResponse.recommendations
      .map(rec => {
        const gathering = gatherings.find(g => g.id === rec.gathering_id)
        if (!gathering) {
          console.warn(`모임 ID ${rec.gathering_id}를 찾을 수 없습니다`)
          return null
        }
        return {
          ...gathering,
          reason: rec.reason
        }
      })
      .filter(Boolean) // null 제거

    return new Response(
      JSON.stringify({ recommendations: recommendationsWithData }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('AI 추천 오류:', error)
    return new Response(
      JSON.stringify({ error: error.message, recommendations: [] }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})