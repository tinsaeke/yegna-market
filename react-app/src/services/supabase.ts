import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lkwlescmmvjqlcpheenj.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd2xlc2NtbXZqcWxjcGhlZW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0NzU5NzcsImV4cCI6MjA1MTA1MTk3N30.VYEhкойте-YOUR-ACTUAL-KEY'

if (supabaseUrl === 'your-supabase-url' || supabaseAnonKey === 'your-supabase-anon-key') {
  console.error('Supabase credentials not configured');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)