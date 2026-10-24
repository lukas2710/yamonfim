import { clearClientResources } from './resource-cache';
import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://nftiussedwyjheqrmlbw.supabase.co'
export const supabaseAnonKey = 'sb_publishable_a07rZpPFzuy0BgrmCsr_Kw_Mq-TQ8x5'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Auth events must not retain metadata loaded under a previous account.
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange(() => { clearClientResources(); });
}
