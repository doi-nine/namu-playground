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
            content: `게임 모임 추천 전문가. 사용자 프로필을 보고 목록에서 최대 5개를 골라 JSON으로 반환.
반드시 목록의 ID만 사용. 응답은 JSON만: {"recommendations":[{"gathering_id":"UUID","reason":"한 문장"}]}`
          },
          {
            role: 'user',
            content: `프로필: 선호=${profile.favorite_game_categories?.join(',') || '없음'}, 지역=${profile.location || '없음'}, 최애=${profile.favorite_game_title || '없음'}, 소개=${profile.bio || '없음'}

모임:
${gatherings.map(g => `${g.id}|${g.title}|${g.category}|${new Date(g.datetime).toLocaleDateString('ko-KR')}|${g.location || g.online_platform || '미정'}|${g.description?.substring(0, 100) || ''}`).join('\n')}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
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