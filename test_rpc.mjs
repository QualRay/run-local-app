import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ovenmqwaxdvyngxwykdn.supabase.co'
const supabaseKey = 'sb_publishable_2U5imZXMl1xFM_dA7kQjDQ_VaR4eWbP'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testRPC() {
  // Try to parse the "aaa" run
  // 0101000020E61000009D3A45FD64705AC03D073B6AF18D4340
  // X = 0x C05A7064FD453A9D = negative something
  // We can just call get_nearby_runs with some coords and see what happens.
  // We'll test a wide radius and different lat/lon combinations.
  
  // Let's first test what PostGIS thinks the coordinates are.
  const { data: dbData, error: dbError } = await supabase.rpc('get_nearby_runs', {
    lat: 38.8951,
    lon: -77.0364, // DC
    radius_meters: 10000000 // Huge radius
  });
  
  console.log('Test DC:', dbData?.length, dbError)
  
  const { data: dbData2, error: dbError2 } = await supabase.rpc('get_nearby_runs', {
    lat: 40.7128,
    lon: -74.0060, // NYC
    radius_meters: 10000000
  });
  
  console.log('Test NYC:', dbData2?.length, dbError2)
}

testRPC()
