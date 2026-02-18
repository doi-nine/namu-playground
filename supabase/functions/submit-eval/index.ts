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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('인증되지 않은 사용자')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { schedule_id, votes } = await req.json()
    // votes: [{ to_user_id, vote_type }]

    if (!schedule_id || !votes || votes.length === 0) {
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 이미 평가했는지 확인
    const { data: existing } = await supabaseAdmin
      .from('popularity_votes')
      .select('id')
      .eq('from_user_id', user.id)
      .eq('schedule_id', schedule_id)
      .limit(1)

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: '이미 평가를 완료했습니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 투표 일괄 삽입 (schedule_id 포함)
    const rows = votes.map((v: any) => ({
      from_user_id: user.id,
      to_user_id: v.to_user_id,
      vote_type: v.vote_type,
      is_active: true,
      schedule_id,
    }))

    const { error: insertError } = await supabaseAdmin
      .from('popularity_votes')
      .insert(rows)

    if (insertError) throw new Error(`투표 저장 실패: ${insertError.message}`)

    // 평가 받은 유저들의 popularity_scores 즉시 재계산
    const ratedUserIds = [...new Set(votes.map((v: any) => v.to_user_id))]
    for (const userId of ratedUserIds) {
      const { data: allVotes } = await supabaseAdmin
        .from('popularity_votes')
        .select('vote_type')
        .eq('to_user_id', userId)
        .eq('is_active', true)

      let total_score = 0
      let kind_count = 0, friendly_count = 0, punctual_count = 0
      let cheerful_count = 0, active_count = 0, vibe_maker_count = 0

      for (const vote of (allVotes || [])) {
        switch (vote.vote_type) {
          case 'thumbs_up': total_score += 1; break
          case 'thumbs_down': total_score -= 1; break
          case 'kind': kind_count += 1; break
          case 'friendly': friendly_count += 1; break
          case 'punctual': punctual_count += 1; break
          case 'cheerful': cheerful_count += 1; break
          case 'active': active_count += 1; break
          case 'vibe_maker': vibe_maker_count += 1; break
        }
      }

      await supabaseAdmin.from('popularity_scores').upsert({
        user_id: userId,
        total_score, kind_count, friendly_count, punctual_count,
        cheerful_count, active_count, vibe_maker_count,
      }, { onConflict: 'user_id' })
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
