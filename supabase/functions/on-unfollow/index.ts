import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const payload = await req.json()
    const { old_record: OLD } = payload

    if (!OLD || !OLD.follower_id || !OLD.following_id) {
      return new Response("Invalid payload", { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Decrement following_count for follower
    const { data: followerData } = await supabase.from('users').select('following_count').eq('id', OLD.follower_id).single()
    const newFollowingCount = Math.max(0, (followerData?.following_count || 0) - 1)
    await supabase.from('users').update({ following_count: newFollowingCount }).eq('id', OLD.follower_id)

    // 2. Decrement follower_count for following
    const { data: followingData } = await supabase.from('users').select('follower_count').eq('id', OLD.following_id).single()
    const newFollowerCount = Math.max(0, (followingData?.follower_count || 0) - 1)
    await supabase.from('users').update({ follower_count: newFollowerCount }).eq('id', OLD.following_id)

    return new Response(JSON.stringify({ message: "Success" }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
