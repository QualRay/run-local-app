-- PART 1 — New tables
CREATE TABLE public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE TABLE public.activity_feed (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('joined_run','hosted_run','checked_in')),
  run_id UUID REFERENCES public.runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_feed_user_created ON public.activity_feed(user_id, created_at DESC);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

-- PART 2 — Existing table changes
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS follower_count INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS following_count INT DEFAULT 0;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active','cancelled'));

-- PART 3 — Enable RLS and policies
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- follows: anyone authenticated can see follows, only own rows can be modified
CREATE POLICY "follows_select" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- activity_feed: users only see feed for people they follow + their own activity
CREATE POLICY "activity_feed_select" ON public.activity_feed FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid()));
CREATE POLICY "activity_feed_insert" ON public.activity_feed FOR INSERT TO authenticated WITH CHECK (false);

-- runs: add update policy scoped to host
CREATE POLICY "runs_update_host" ON public.runs FOR UPDATE TO authenticated USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY "runs_delete_host" ON public.runs FOR DELETE TO authenticated USING (host_id = auth.uid());
