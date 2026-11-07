import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase credentials from Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[SMARTRETURN AI] Missing Supabase environment variables. ' +
    'Please copy .env.example to .env and configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

// Create and export Supabase client using anon key with Row Level Security (RLS)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
