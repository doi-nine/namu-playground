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

    const prompt = `사용자가 작성한 자기소개를 분석해서 매력적인 프로필로 만들어줘.

사용자 자기소개:
"${rawIntro}"

목표:
1. 원문의 핵심 의도는 유지하되, 더 매력적이고 구체적으로 표현
2. 자연스러운 구어체 유지 (형식적이지 않게)
3. 이 사람과 놀고 싶어지는 느낌이 들도록
4. 성격이나 분위기가 느껴지도록

다음 정보를 JSON 형태로 추출해줘:
- favorite_game_categories: 배열 형태, 다음 중에서만 선택 ["경찰과 도둑", "마피아 게임", "보드게임", "방탈출", "PC 게임", "콘솔 게임", "모바일 게임", "카드 게임"]
- favorite_game_title: 문자열, 가장 좋아하는 게임 이름 (언급되지 않으면 null)
- recent_games: 문자열, 최근 플레이중인 게임들 (언급되지 않으면 null)
- bio: 문자열, 자기소개를 매력적으로 재작성 (50-80자 이내). 원문의 의도를 살리되 더 생동감 있고 구체적으로.
- age_range: 문자열, 나이 정보 추출 (20대 초반, 20대 후반, 30대 초반, 30대 후반, 40대+) (언급 안 되면 null)
- location: 문자열, 지역 정보 (언급 안 되면 null)

bio 작성 예시:
입력: "같이 보드게임 카페 다닐 사람 구함"
출력: "주말마다 보드게임 카페에서 전략 게임 즐기는 거 좋아해요! 같이 다니실 분 찾아요 🎲"

입력: "마피아 게임 좋아합니다"
출력: "마피아 게임 진심러! 추리하고 블러핑하는 재미에 푹 빠져있어요 🕵️"

스타일 가이드:
- 이모지 1-2개 사용 가능 (너무 많지 않게)
- "~요", "~해요", "~어요" 같은 자연스러운 종결어미
- 느낌표나 물음표로 생동감 추가
- 구체적인 상황이나 감정 표현

응답은 반드시 JSON만 출력하고, 다른 텍스트는 포함하지 마.`;

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
            content: '당신은 게임 커뮤니티의 프로필 작성 전문가입니다. 사용자의 간단한 소개를 매력적이고 친근한 자기소개로 바꿔줍니다. 형식적이지 않고 자연스러운 구어체를 사용합니다.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
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