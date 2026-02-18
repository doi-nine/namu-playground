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
    const { profile, gatherings, userId } = await req.json()

    if (!profile || !gatherings || gatherings.length === 0) {
      return new Response(
        JSON.stringify({ recommendations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 서비스 키로 DB 접근하여 가입한 모임 필터링 (RLS 우회)
    let filteredGatherings = gatherings
    if (userId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      const { data: joined } = await supabase
        .from('gathering_members')
        .select('gathering_id')
        .eq('user_id', userId)
      const joinedIds = new Set((joined || []).map((m: any) => m.gathering_id))
      filteredGatherings = gatherings.filter((g: any) => !joinedIds.has(g.id))
    }

    if (filteredGatherings.length === 0) {
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
${filteredGatherings.map((g: any) => `${g.id}|${g.title}|${g.category}|${new Date(g.datetime).toLocaleDateString('ko-KR')}|${g.location || g.online_platform || '미정'}|${g.description?.substring(0, 100) || ''}`).join('\n')}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    })

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text()
      throw new Error(`OpenAI API 호출 실패 (${openaiResponse.status}): ${errBody.substring(0, 200)}`)
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
    const recommendedIds = parsedResponse.recommendations.map((r: any) => r.gathering_id)
    const recommendationsWithData = parsedResponse.recommendations
      .map((rec: any) => {
        const gathering = filteredGatherings.find((g: any) => g.id === rec.gathering_id)
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