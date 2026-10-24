import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './supabase';
import { PLANS } from '@/app/abonnement/plans';

// Durations understood by Admin VIP and the expiry countdowns.
export const VIP_DURATIONS: Record<string, '15d' | '3m' | '1y'> = { '2w': '15d', '3m': '3m', '1y': '1y' };

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

export const stripe = () => new Stripe(required('STRIPE_SECRET_KEY'));
export const planById = (id: unknown) => PLANS.find(plan => plan.id === id && VIP_DURATIONS[plan.id]);

// Resolves the member from the Supabase access token sent by the browser.
export async function userFromRequest(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

export const adminDatabase = () => createClient(supabaseUrl, required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
