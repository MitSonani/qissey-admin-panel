import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined') {
        throw new Error("Supabase environment variables are missing in the browser. Ensure they are prefixed with NEXT_PUBLIC_");
    }
}

export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string);
