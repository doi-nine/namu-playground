import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY가 설정되지 않았습니다' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { rawIntro } = await req.json();

    if (!rawIntro || !rawIntro.trim()) {
      return new Response(
        JSON.stringify({ error: '자기소개 내용이 필요합니다' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const prompt = `사용자가 작성한 자기소개를 다듬어줘.

사용자 원문:
"${rawIntro}"

## bio 작성 규칙 (반드시 지켜)
1. 원문에 없는 내용을 지어내지 마
2. 원문의 의미를 바꾸지 마. 문장을 자연스럽게 다듬기만 해
3. 이모지 쓰지 마
4. "~요", "~어요" 같은 자연스러운 종결어미 사용
5. 50~100자 이내
6. 감탄사, 과장 표현 쓰지 마 ("푹 빠져있어요!", "진심러!" 같은 거 금지)

## bio 좋은 예시
입력: "같이 보드게임 카페 다닐 사람 구함"
출력: "주말에 보드게임 카페 같이 다닐 사람을 찾고 있어요."

입력: "평소에는 넷플릭스를 많이 봅니다. 보드게임을 좋아하지만 같이 갈 사람이 없어서 못 간지 오래됐어요."
출력: "평소엔 넷플릭스를 많이 보고, 보드게임도 좋아하는데 같이 갈 사람이 없어서 한동안 못 가서 아쉬웠어요."

입력: "마피아 게임 좋아합니다"
출력: "마피아 게임을 좋아해요. 추리하고 블러핑하는 게 재밌어요."

## bio 나쁜 예시 (이렇게 쓰면 안 됨)
- "넷플릭스 보면서 보드게임에 푹 빠졌어요! 🎲" (원문 왜곡 + 이모지)
- "마피아 게임 진심러! 🕵️" (과장 + 이모지)
- "같이 다니실 분 찾아요 🎲" (이모지)

## 나머지 필드 추출 규칙
- favorite_game_categories: 다음 중에서만 선택 ["경찰과 도둑", "마피아 게임", "보드게임", "방탈출", "PC 게임", "콘솔 게임", "모바일 게임", "카드 게임"]. 언급 안 되면 빈 배열
- favorite_game_title: 구체적 게임 이름이 언급된 경우만. 없으면 null
- recent_games: 최근 플레이 중인 게임. 없으면 null
- age_range: "20대 초반/후반", "30대 초반/후반", "40대+" 중 택1. 없으면 null
- location: 지역 정보. 없으면 null

응답은 반드시 JSON만 출력:
{"bio": "...", "favorite_game_categories": [], "favorite_game_title": null, "recent_games": null, "age_range": null, "location": null}`;

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
            content: '너는 사용자의 자기소개 원문을 자연스럽게 다듬어주는 도우미야. 원문의 의미를 절대 바꾸지 말고, 문장만 매끄럽게 정리해. 없는 내용을 추가하거나 과장하지 마.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API 오류:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI API 오류 (${response.status})` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('AI 응답:', generatedText);

    // JSON 파싱 (마크다운 제거 + regex 폴백)
    let profileData;
    try {
      let cleanedText = generatedText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```\n?/g, '');
      }
      profileData = JSON.parse(cleanedText);
    } catch {
      // regex 폴백: JSON 객체 추출
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        profileData = JSON.parse(jsonMatch[0]);
      } else {
        return new Response(
          JSON.stringify({ error: 'AI 응답을 파싱할 수 없습니다' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    console.log('파싱된 프로필:', profileData);

    return new Response(
      JSON.stringify(profileData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});