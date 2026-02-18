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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_ids } = await req.json()
    if (!user_ids || user_ids.length === 0) {
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    for (const userId of user_ids) {
      // 해당 유저의 모든 활성 투표 집계
      const { data: votes } = await supabaseAdmin
        .from('popularity_votes')
        .select('vote_type')
        .eq('to_user_id', userId)
        .eq('is_active', true)

      if (!votes) continue

      let total_score = 0
      let kind_count = 0
      let friendly_count = 0
      let punctual_count = 0
      let cheerful_count = 0
      let active_count = 0
      let vibe_maker_count = 0

      for (const vote of votes) {
        switch (vote.vote_type) {
          case 'thumbs_up':
            total_score += 1
            break
          case 'thumbs_down':
            total_score -= 1
            break
          case 'kind':
            kind_count += 1
            total_score += 1
            break
          case 'friendly':
            friendly_count += 1
            total_score += 1
            break
          case 'punctual':
            punctual_count += 1
            total_score += 1
            break
          case 'cheerful':
            cheerful_count += 1
            total_score += 1
            break
          case 'active':
            active_count += 1
            total_score += 1
            break
          case 'vibe_maker':
            vibe_maker_count += 1
            total_score += 1
            break
        }
      }

      await supabaseAdmin
        .from('popularity_scores')
        .upsert({
          user_id: userId,
          total_score,
          kind_count,
          friendly_count,
          punctual_count,
          cheerful_count,
          active_count,
          vibe_maker_count,
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
