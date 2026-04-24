import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ovenmqwaxdvyngxwykdn.supabase.co'
const supabaseKey = 'sb_publishable_2U5imZXMl1xFM_dA7kQjDQ_VaR4eWbP'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testRPC() {
  const { data, error } = await supabase.rpc('get_nearby_runs', {
    lat: 38.8951,
    lon: -77.0364, 
    radius_meters: 8046 // integer
  });
  
  console.log('Test DC:', data?.length, error)
}

testRPC()
