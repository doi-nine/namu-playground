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

    const { target_user_id, vote_type, is_active, gathering_id } = await req.json()

    if (gathering_id) {
      // === 모임 완료 후 상호 평가 모드 ===
      // service role 클라이언트 (RLS 우회하여 모든 조회/쓰기 가능)
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // 모임이 완료되었는지 확인
      const { data: gathering, error: gatheringErr } = await supabaseAdmin
        .from('gatherings')
        .select('id, is_completed, creator_id')
        .eq('id', gathering_id)
        .single()

      if (gatheringErr) throw new Error(`모임 조회 실패: ${gatheringErr.message}`)
      if (!gathering) throw new Error('모임을 찾을 수 없습니다.')
      if (!gathering.is_completed) throw new Error('아직 완료되지 않은 모임입니다.')

      // 본인이 해당 모임의 approved 멤버이거나 모임장인지 확인
      const isCreator = gathering.creator_id === user.id
      if (!isCreator) {
        const { data: membership } = await supabaseAdmin
          .from('gathering_members')
          .select('status')
          .eq('gathering_id', gathering_id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (!membership || membership.status !== 'approved') {
          throw new Error('해당 모임의 참가자만 평가할 수 있습니다.')
        }
      }

      // 대상도 해당 모임의 approved 멤버이거나 모임장인지 확인
      const targetIsCreator = gathering.creator_id === target_user_id
      if (!targetIsCreator) {
        const { data: targetMembership } = await supabaseAdmin
          .from('gathering_members')
          .select('status')
          .eq('gathering_id', gathering_id)
          .eq('user_id', target_user_id)
          .maybeSingle()

        if (!targetMembership || targetMembership.status !== 'approved') {
          throw new Error('해당 모임의 참가자만 평가할 수 있습니다.')
        }
      }

      // 동일 gathering_id + from_user + to_user + vote_type 중복 확인
      const { data: existingGatheringVote } = await supabaseAdmin
        .from('popularity_votes')
        .select('id')
        .eq('from_user_id', user.id)
        .eq('to_user_id', target_user_id)
        .eq('vote_type', vote_type)
        .eq('gathering_id', gathering_id)
        .maybeSingle()

      if (existingGatheringVote) {
        throw new Error('이미 이 모임에서 해당 평가를 했습니다.')
      }

      // 새로운 투표 생성 (gathering_id 포함)
      if (is_active) {
        const { error: voteInsertError } = await supabaseAdmin
          .from('popularity_votes')
          .insert({
            from_user_id: user.id,
            to_user_id: target_user_id,
            vote_type,
            is_active,
            gathering_id
          })

        if (voteInsertError) {
          throw new Error(`투표 저장 실패: ${voteInsertError.message}`)
        }

        // 인기도 점수는 프론트엔드에서 RPC(increment_popularity)로 직접 업데이트

        // 알림 전송 (thumbs_up/thumbs_down만)
        if (vote_type === 'thumbs_up' || vote_type === 'thumbs_down') {
          const label = vote_type === 'thumbs_up' ? '👍 좋아요' : '👎 별로예요'
          await supabaseAdmin
            .from('notifications')
            .insert({
              user_id: target_user_id,
              type: 'popularity_received',
              message: `누군가 회원님에게 "${label}" 평가를 남겼습니다!`,
              gathering_id,
              related_user_id: null
            })
        }
      }
    } else {
      // === 기존 로직: 프리미엄 + 일일 제한 ===

      // 프리미엄 확인
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .single()

      if (!profile?.is_premium) {
        throw new Error('프리미엄 회원만 사용할 수 있는 기능입니다.')
      }

      // 오늘 이미 투표했는지 확인
      const today = new Date().toISOString().split('T')[0]
      const { data: existingLimit } = await supabaseClient
        .from('daily_vote_limits')
        .select('*')
        .eq('user_id', user.id)
        .eq('target_user_id', target_user_id)
        .eq('last_voted_at', today)
        .maybeSingle()

      // 기존 투표 확인
      const { data: existingVote } = await supabaseClient
        .from('popularity_votes')
        .select('*')
        .eq('from_user_id', user.id)
        .eq('to_user_id', target_user_id)
        .eq('vote_type', vote_type)
        .maybeSingle()

      let shouldSendNotification = false

      if (existingVote) {
        // 기존 투표 업데이트
        const wasActive = existingVote.is_active

        await supabaseClient
          .from('popularity_votes')
          .update({
            is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingVote.id)

        // false -> true로 변경될 때만 알림
        if (!wasActive && is_active) {
          shouldSendNotification = true
        }
      } else {
        // 하루에 한 번만 새로운 투표 가능
        if (existingLimit) {
          throw new Error('하루에 한 번만 투표할 수 있습니다.')
        }

        // 새로운 투표 생성
        if (is_active) {
          await supabaseClient
            .from('popularity_votes')
            .insert({
              from_user_id: user.id,
              to_user_id: target_user_id,
              vote_type,
              is_active
            })

          // 일일 제한 기록
          await supabaseClient
            .from('daily_vote_limits')
            .insert({
              user_id: user.id,
              target_user_id,
              last_voted_at: today
            })

          shouldSendNotification = true
        }
      }

      // 알림 전송 (올릴 때만)
      if (shouldSendNotification) {
        const voteTypeNames: Record<string, string> = {
          kind: '정말 친절해요',
          friendly: '친화력이 좋아요',
          punctual: '약속 시간을 잘 지켜요',
          cheerful: '유쾌해요',
          active: '적극적이에요'
        }

        await supabaseClient
          .from('notifications')
          .insert({
            user_id: target_user_id,
            type: 'popularity_received',
            message: `누군가 회원님에게 "${voteTypeNames[vote_type]}" 인기도를 주었습니다! 👍`,
            gathering_id: null,
            related_user_id: null // 익명
          })
      }
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
        status: 200
      }
    )
  }
})