import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, user_email } = await req.json()

    if (!user_id || !user_email) {
      throw new Error('user_id와 user_email이 필요합니다')
    }

    console.log('체크아웃 요청:', { user_id, user_email })

    // Polar API 호출 (최신 방식)
    const polarResponse = await fetch('https://api.polar.sh/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('POLAR_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: Deno.env.get('POLAR_PRODUCT_ID'),
        customer_email: user_email,
        customer_metadata: {
          user_id: user_id,
        },
        success_url: `${Deno.env.get('APP_URL')}/premium/success`,
      }),
    })

    if (!polarResponse.ok) {
      const errorText = await polarResponse.text()
      console.error('Polar API 오류:', errorText)
      throw new Error(`Polar 체크아웃 생성 실패: ${errorText}`)
    }

    const checkoutData = await polarResponse.json()
    console.log('체크아웃 성공:', checkoutData.url)

    return new Response(
      JSON.stringify({ 
        checkout_url: checkoutData.url,
        checkout_id: checkoutData.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('체크아웃 생성 오류:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})