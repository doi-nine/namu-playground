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
    const { profile, userId } = await req.json()

    if (!profile || !userId) {
      return new Response(
        JSON.stringify({ recommendations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 서비스 키로 DB 직접 접근 (RLS 우회)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1) 내가 가입한 모임 ID 조회
    const { data: joined } = await supabase
      .from('gathering_members')
      .select('gathering_id')
      .eq('user_id', userId)
    const joinedIds = new Set((joined || []).map((m: any) => m.gathering_id))

    // 2) 참여한 모임 태그 히스토리 수집
    let joinedTags: string[] = []
    if (joinedIds.size > 0) {
      const { data: joinedGatherings } = await supabase
        .from('gatherings')
        .select('tags')
        .in('id', [...joinedIds])
      joinedTags = (joinedGatherings || [])
        .flatMap((g: any) => g.tags || [])
        .filter(Boolean)
    }
    // 태그 빈도 집계 (상위 10개)
    const joinedTagFreq: Record<string, number> = {}
    joinedTags.forEach(t => { joinedTagFreq[t] = (joinedTagFreq[t] || 0) + 1 })
    const topJoinedTags = Object.entries(joinedTagFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag)

    // 3) 즐겨찾기한 모임 태그 수집
    const { data: bookmarks } = await supabase
      .from('gathering_bookmarks')
      .select('gathering_id')
      .eq('user_id', userId)
    const bookmarkIds = (bookmarks || []).map((b: any) => b.gathering_id)

    let bookmarkTags: string[] = []
    if (bookmarkIds.length > 0) {
      const { data: bookmarkedGatherings } = await supabase
        .from('gatherings')
        .select('tags')
        .in('id', bookmarkIds)
      bookmarkTags = (bookmarkedGatherings || [])
        .flatMap((g: any) => g.tags || [])
        .filter(Boolean)
    }
    const uniqueBookmarkTags = [...new Set(bookmarkTags)]

    // 4) 미가입 + 내가 만든 것 제외한 모임 조회 (최대 50개)
    const { data: allGatherings, error: gatheringsError } = await supabase
      .from('gatherings')
      .select('*')
      .neq('creator_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (gatheringsError) throw gatheringsError

    // 5) 가입한 모임 + 정원 초과 제외
    const available = (allGatherings || []).filter(
      (g: any) => !joinedIds.has(g.id) && g.current_members < g.max_members
    ).slice(0, 20)

    if (available.length === 0) {
      return new Response(
        JSON.stringify({ recommendations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 나이대 문자열 구성
    const ageContext = profile.age_range
      ? profile.age_range
      : profile.birth_year
        ? `${new Date().getFullYear() - profile.birth_year + 1}세`
        : '미기재'

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
            content: `게임/취미 모임 추천 전문가. 사용자 프로필과 활동 히스토리를 종합적으로 분석하여 아래 목록에서 최적의 모임을 추천.
목록은 이미 사용자가 가입하지 않은 모임만 포함됨. 목록에 모임이 있으면 최소 1개는 반드시 추천하고 최대 5개까지 추천.
추천 시 우선순위: ①즐겨찾기 태그 일치 ②참여 히스토리 태그 일치 ③관심 카테고리 일치 ④나이대·지역 적합성.
반드시 목록의 ID만 사용. 응답은 JSON만: {"recommendations":[{"gathering_id":"UUID","reason":"한 문장"}]}`
          },
          {
            role: 'user',
            content: `[사용자 프로필]
- 관심 카테고리(하고 싶은 것): ${profile.favorite_game_categories?.join(', ') || '없음'}
- 나이대: ${ageContext}
- 지역: ${profile.location || '없음'}
- 최애 게임/활동: ${profile.favorite_game_title || '없음'}
- 최근 즐긴 것: ${profile.recent_games || '없음'}
- 자기소개: ${profile.bio || '없음'}

[활동 히스토리]
- 참여한 모임 주요 태그(빈도순): ${topJoinedTags.length > 0 ? topJoinedTags.join(', ') : '없음'}
- 즐겨찾기한 모임 태그: ${uniqueBookmarkTags.length > 0 ? uniqueBookmarkTags.join(', ') : '없음'}

[추천 후보 모임]
${available.map((g: any) => `${g.id}|${g.title}|태그:${(g.tags || []).join('/')}|지역:${g.location || g.online_platform || '미정'}|${g.description?.substring(0, 80) || ''}`).join('\n')}`
          }
        ],
        temperature: 0.7,
        max_tokens: 600
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
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('AI 응답을 파싱할 수 없습니다')
      }
    }

    // 추천된 모임 ID로 실제 데이터 가져오기
    let recommendationsWithData = (parsedResponse.recommendations || [])
      .map((rec: any) => {
        const gathering = available.find((g: any) => g.id === rec.gathering_id)
        if (!gathering) return null
        return { ...gathering, reason: rec.reason }
      })
      .filter(Boolean)

    // AI가 빈 추천을 반환했지만 available 모임이 있는 경우 폴백
    if (recommendationsWithData.length === 0 && available.length > 0) {
      recommendationsWithData = available.slice(0, 5).map((g: any) => ({
        ...g,
        reason: '새로운 사람들과 함께할 수 있는 모임이에요!'
      }))
    }

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
