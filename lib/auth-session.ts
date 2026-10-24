import { supabase } from './supabase';
import { createSessionReader } from './session-reader';
import { withTimeout } from './with-timeout';

const reader = createSessionReader(() => withTimeout(
  supabase.auth.getSession(), 12000, 'Connexion temporairement indisponible. Vérifie ta connexion Internet puis réessaie.'
));
// Never restore old tokens ourselves: Supabase owns refresh, rotation and revocation.
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') reader.invalidate();
  });
}
export const getPersistentSession = () => reader.read();
