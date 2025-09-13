import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testSupabase() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Test creating a table
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .limit(1);

    if (error) {
      console.log('Table does not exist yet, but connection is working');
      console.log('Error details:', error);
    } else {
      console.log('✅ Supabase connection successful!');
      console.log('Data:', data);
    }
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
  }
}

testSupabase();