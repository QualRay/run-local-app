import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ovenmqwaxdvyngxwykdn.supabase.co'
const supabaseKey = 'sb_publishable_2U5imZXMl1xFM_dA7kQjDQ_VaR4eWbP'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkParticipants() {
  const { data, error } = await supabase.from('participants').select('*');
  console.log('Participants:', data, error)
  const { data: p2, error: e2 } = await supabase.from('run_participants').select('*');
  console.log('Run_participants:', p2, e2)
}

checkParticipants()
