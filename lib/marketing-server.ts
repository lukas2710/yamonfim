import type { User } from '@supabase/supabase-js';
import { adminDatabase } from './stripe-server';

// HMAC key for unsubscribe links; set UNSUBSCRIBE_SECRET in Vercel to rotate it independently.
export function unsubscribeSecret() {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Variable d’environnement manquante : UNSUBSCRIBE_SECRET');
  return secret;
}

export async function listAllUsers(): Promise<User[]> {
  const admin = adminDatabase().auth.admin;
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}
