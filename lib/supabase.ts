import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;



if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase Environment Variables:");
    console.error("NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl);
    console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "[REDACTED]" : "MISSING");
    throw new Error("Missing Supabase configuration. Please check your .env file and restart the dev server.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
