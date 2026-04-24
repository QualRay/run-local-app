import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ovenmqwaxdvyngxwykdn.supabase.co'
const supabaseKey = 'sb_publishable_2U5imZXMl1xFM_dA7kQjDQ_VaR4eWbP'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testRPCs() {
  const variations = [
    { name: 'get_nearby_runs', args: { lat: 38, lon: -77, radius_meters: 1000 } },
    { name: 'get_nearby_runs', args: { lat: 38, lng: -77, radius_meters: 1000 } },
    { name: 'get_nearby_runs', args: { latitude: 38, longitude: -77, radius_meters: 1000 } },
    { name: 'get_nearby_runs', args: { lat: 38, lon: -77, radius: 1000 } },
    { name: 'nearby_runs', args: { lat: 38, lon: -77, radius_meters: 1000 } },
    { name: 'nearby_locations', args: { lat: 38, lon: -77, radius_meters: 1000 } },
  ];

  for (const v of variations) {
    const { data, error } = await supabase.rpc(v.name, v.args);
    if (!error) {
       console.log(`SUCCESS: ${v.name} with args`, Object.keys(v.args));
       return;
    } else {
       if (error.code !== 'PGRST202') { // PGRST202 is 'not found'
          console.log(`FOUND BUT ERROR: ${v.name} with args`, Object.keys(v.args), error);
       }
    }
  }
  console.log("None of the variations found the RPC.");
}

testRPCs()
