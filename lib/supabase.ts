import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nftiussedwyjheqrmlbw.supabase.co'
const supabaseAnonKey = 'sb_publishable_a07rZpPFzuy0BgrmCsr_Kw_Mq-TQ8x5'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})