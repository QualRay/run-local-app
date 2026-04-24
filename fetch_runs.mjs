import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ovenmqwaxdvyngxwykdn.supabase.co'
const supabaseKey = 'sb_publishable_2U5imZXMl1xFM_dA7kQjDQ_VaR4eWbP'
const supabase = createClient(supabaseUrl, supabaseKey)

async function getRuns() {
  const { data, error } = await supabase.from('runs').select('*');
  console.log('Runs:', JSON.stringify(data, null, 2))
  console.log('Error:', error)
}

getRuns()
