import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record: NEW } = payload

    if (!NEW || !NEW.follower_id || !NEW.following_id) {
      return new Response("Invalid payload", { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Increment following_count for follower
    const { data: followerData } = await supabase.from('users').select('following_count').eq('id', NEW.follower_id).single()
    await supabase.from('users').update({ following_count: (followerData?.following_count || 0) + 1 }).eq('id', NEW.follower_id)

    // 2. Increment follower_count for following
    const { data: followingData } = await supabase.from('users').select('follower_count').eq('id', NEW.following_id).single()
    await supabase.from('users').update({ follower_count: (followingData?.follower_count || 0) + 1 }).eq('id', NEW.following_id)

    // 3. Insert into activity_feed for each follower of NEW.follower_id
    const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', NEW.follower_id)
    if (followers && followers.length > 0) {
      const feedInserts = followers.map((f: any) => ({
        user_id: f.follower_id,
        actor_id: NEW.follower_id,
        type: 'followed_user',
        run_id: null
      }))
      await supabase.from('activity_feed').insert(feedInserts)
    }

    return new Response(JSON.stringify({ message: "Success" }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
