import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record: NEW } = payload

    if (!NEW || !NEW.user_id || !NEW.run_id) {
      return new Response("Invalid payload", { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch all followers of NEW.user_id
    const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', NEW.user_id)
    
    // 2. Insert into activity_feed for each follower
    if (followers && followers.length > 0) {
      const feedInserts = followers.map((f: any) => ({
        user_id: f.follower_id,
        actor_id: NEW.user_id,
        type: 'joined_run',
        run_id: NEW.run_id
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
