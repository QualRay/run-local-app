import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This is meant to be hit by a Cron Job (e.g. Vercel Cron) every 15-30 minutes
export async function GET(request: Request) {
  // Use service role key to bypass RLS for system operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60000);
    // Buffer time to not duplicate alerts (e.g. within a 15 min window)
    const windowEnd = new Date(oneHourFromNow.getTime() + 15 * 60000); 

    // Find runs starting in exactly 1 hour
    const { data: upcomingRuns, error: runError } = await supabase
      .from('runs')
      .select('id, title, start_time')
      .gte('start_time', oneHourFromNow.toISOString())
      .lte('start_time', windowEnd.toISOString());

    if (runError) throw runError;
    if (!upcomingRuns || upcomingRuns.length === 0) {
      return NextResponse.json({ message: 'No runs starting in 1 hour.' });
    }

    let notificationsSent = 0;

    // For each run, notify the participants
    for (const run of upcomingRuns) {
      const { data: participants } = await supabase
        .from('run_participants')
        .select('user_id, users(notifications_enabled)')
        .eq('run_id', run.id);

      if (participants) {
        for (const p of participants) {
          // If the user has notifications enabled
          if (p.users && (p.users as any).notifications_enabled) {
            await supabase.from('notifications').insert([
              {
                user_id: p.user_id,
                type: 'reminder',
                content: `Reminder: '${run.title}' starts in 1 hour! Get ready to run.`,
              }
            ]);
            notificationsSent++;
          }
        }
      }
    }

    return NextResponse.json({ success: true, notificationsSent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
