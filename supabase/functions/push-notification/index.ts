import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Interface cho subscription của trình duyệt
interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Xử lý CORS cho các yêu cầu pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
    const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@bank.com.vn'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Dữ liệu từ Webhook gửi đến (Bảng notifications)
    const { record } = await req.json()
    const { user_id, title, content, link } = record

    if (!user_id) {
      return new Response(JSON.stringify({ message: 'No user_id found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 1. Truy vấn các thiết bị đã đăng ký của user nhận thông báo
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)

    if (subError || !subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'No active subscriptions for this user' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Chuẩn bị nội dung thông báo linh hoạt
    const payload = {
      title: title || "WorkFlow Portal",
      body: content || "Bạn có thông báo mới",
      url: link || '/dashboard'
    }

    // 3. Gửi thông báo bằng thư viện web-push (sử dụng ESM import cho Deno)
    // Lưu ý: Chúng ta dùng thư viện từ esm.sh để tương thích với Deno
    console.log(`Sending notification to user ${user_id}: ${title}`)
    
    const webpush = await import("https://esm.sh/web-push")
    webpush.setVapidDetails(subject, publicKey, privateKey)

    const notifications = subscriptions.map(async (sub, index) => {
      try {
        const res = await webpush.sendNotification(sub.subscription, JSON.stringify(payload))
        console.log(`Device ${index} success:`, res.statusCode)
        return res
      } catch (err) {
        console.error(`Device ${index} failed:`, err.message)
        return null
      }
    })

    const results = await Promise.all(notifications)

    return new Response(JSON.stringify({ success: true, count: notifications.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Edge Function Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
