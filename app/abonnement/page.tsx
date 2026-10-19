'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/* À PERSONNALISER                                                     */
/* ------------------------------------------------------------------ */

type Plan = {
  id: string;
  name: string;
  price: number;
  days: number;
  tagline: string;
  badge?: string;
  stripeLink: string;
};

const PLANS: Plan[] = [
  { id: '2w', name: '2 semaines', price: 3.99, days: 14,  tagline: 'Idéal pour essayer', stripeLink: 'https://buy.stripe.com/aFa7sK2HT9tnfaD3qif3a0n' },
  { id: '3m', name: '3 mois',     price: 15,   days: 91,  tagline: 'Le bon équilibre',   stripeLink: 'https://buy.stripe.com/eVq6oGeqBbBvbYrbWOf3a0m', badge: 'Populaire' },
  { id: '1y', name: '1 an',       price: 50,   days: 365, tagline: 'Le plus économique', stripeLink: 'https://buy.stripe.com/bJedR896h8pjbYrd0Sf3a0o', badge: 'Meilleure offre' },
];

const DEFAULT_PLAN_ID = '3m';
const STRIPE_PORTAL_URL = '';
const SUPPORT_EMAIL = '';

type VipDurationType = '15d' | '3m' | '1y';

const formatEuro = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0 });

const BASE_DAILY = PLANS[0].price / PLANS[0].days;
const perMonth = (p: Plan) => (p.price / p.days) * 30.44;
const savingPct = (p: Plan) => Math.round((1 - p.price / p.days / BASE_DAILY) * 100);

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
const MAX_FREE_LIMIT = 5;

/* ------------------------------------------------------------------ */
/* Avis Utilisateurs                                                  */
/* ------------------------------------------------------------------ */

interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
}

const INITIAL_REVIEWS: Review[] = [
  { id: '1', name: 'Maxime L.', rating: 5, comment: 'L’accès VIP vaut vraiment le coup, zéro pub et le catalogue charge super vite !', date: 'Il y a 2 jours' },
  { id: '2', name: 'Sonia K.', rating: 5, comment: 'Très bonne application. Les 5 visions gratuites m’ont permis de tester avant de prendre 3 mois.', date: 'Il y a 5 jours' },
  { id: '3', name: 'Thomas B.', rating: 4, comment: 'Paiement Stripe rapide et le VIP s’est activé dans la minute. Au top.', date: 'Il y a 1 semaine' },
];

/* ------------------------------------------------------------------ */
/* Composant Compte à Rebours VIP                                      */
/* ------------------------------------------------------------------ */

function VipCountdownClient({
  startDate,
  duration,
}: {
  startDate?: string;
  duration?: VipDurationType;
}) {
  const [timeLeft, setTimeLeft] = useState<{
    expired: boolean;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ expired: false, days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!startDate || !duration) return;

    const start = new Date(startDate).getTime();
    if (isNaN(start)) return;

    const expiration = new Date(start);
    if (duration === '15d') {
      expiration.setDate(expiration.getDate() + 15);
    } else if (duration === '3m') {
      expiration.setMonth(expiration.getMonth() + 3);
    } else if (duration === '1y') {
      expiration.setFullYear(expiration.getFullYear() + 1);
    }

    const expTime = expiration.getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = expTime - now;

      if (difference <= 0) {
        setTimeLeft({ expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        expired: false,
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startDate, duration]);

  if (timeLeft.expired) {
    return (
      <div className="rounded-2xl bg-red-600/10 px-6 py-4 text-center ring-1 ring-red-500/30">
        <p className="text-sm font-bold text-red-400">Ton abonnement VIP a expiré</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/20 via-[#16130f] to-amber-600/10 p-6 shadow-[0_0_50px_-15px_rgba(245,158,11,0.3)] ring-1 ring-amber-500/40">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
      
      <p className="mb-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        Temps VIP Restant
      </p>

      <div className="grid grid-cols-4 gap-2 text-center sm:gap-4">
        <div className="rounded-2xl bg-black/40 p-3 ring-1 ring-white/10">
          <span className="block text-2xl font-black tabular-nums text-white sm:text-3xl">{timeLeft.days}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Jours</span>
        </div>
        <div className="rounded-2xl bg-black/40 p-3 ring-1 ring-white/10">
          <span className="block text-2xl font-black tabular-nums text-white sm:text-3xl">{timeLeft.hours}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Heures</span>
        </div>
        <div className="rounded-2xl bg-black/40 p-3 ring-1 ring-white/10">
          <span className="block text-2xl font-black tabular-nums text-white sm:text-3xl">{timeLeft.minutes}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Min</span>
        </div>
        <div className="rounded-2xl bg-black/40 p-3 ring-1 ring-white/10">
          <span className="block text-2xl font-black tabular-nums text-amber-400 sm:text-3xl">{timeLeft.seconds}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Sec</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compte à Rebours Hebdomadaire (Gratuit)                            */
/* ------------------------------------------------------------------ */

function WeeklyResetCountdown() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    // Calcul de la prochaine échéance (par exemple, chaque dimanche à minuit ou dans exactement 7 jours glissants)
    const calculateTime = () => {
      const now = new Date();
      // On fixe la réinitialisation au prochain dimanche à 00:00 ou on simule un cycle de 7 jours basé sur la semaine
      const nextReset = new Date();
      nextReset.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
      nextReset.setHours(0, 0, 0, 0);

      const diff = nextReset.getTime() - now.getTime();
      if (diff <= 0) return;

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-3 flex items-center justify-between rounded-xl bg-black/30 px-3.5 py-2.5 text-xs text-zinc-300 ring-1 ring-white/5">
      <span className="text-zinc-400">Remise à zéro dans :</span>
      <span className="font-bold tabular-nums text-amber-400">
        {timeLeft.days}j {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icônes                                                              */
/* ------------------------------------------------------------------ */

type IconName =
  | 'back' | 'crown' | 'check' | 'close' | 'lock' | 'infinity' | 'play'
  | 'zap' | 'tv' | 'shield' | 'chevron' | 'card' | 'sparkles' | 'refresh' | 'request'
  | 'mail' | 'help' | 'copy' | 'star' | 'alert';

const ICONS: Record<IconName, React.ReactNode> = {
  back: <path d="M19 12H5m6-7-7 7 7 7" />,
  crown: <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  infinity: <path d="M18.2 8.5c2.4 0 3.8 1.6 3.8 3.5s-1.4 3.5-3.8 3.5c-3.6 0-8.8-7-12.4-7C3.4 8.5 2 10.1 2 12s1.4 3.5 3.8 3.5c3.6 0 8.8-7 12.4-7Z" />,
  play: <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor" stroke="none" />,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  tv: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="m8 2 4 4 4-4" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>,
  sparkles: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />,
  refresh: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
  request: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3h.01" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="none" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></>,
};

function Icon({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const PERKS = [
  { icon: 'infinity' as IconName, title: 'Visionnage illimité', text: 'Plus aucune limite : regarde autant de films et d\'épisodes que tu veux.' },
  { icon: 'play' as IconName, title: 'Tout le catalogue', text: 'Accès complet à tous les films et toutes les séries, saison après saison.' },
  { icon: 'tv' as IconName, title: 'Sur tous tes écrans', text: 'Téléphone, ordinateur, tablette ou TV, avec le même compte.' },
  { icon: 'zap' as IconName, title: 'Activation immédiate', text: 'Ton accès VIP est activé juste après le paiement.' },
];

const COMPARE = [
  { label: 'Nombre de visions', free: `${MAX_FREE_LIMIT} / semaine`, vip: 'Illimité' },
  { label: 'Films et séries', free: true, vip: true },
  { label: 'Reprendre la lecture', free: true, vip: true },
  { label: 'Accès mobile, PC et TV', free: true, vip: true },
  { label: 'Aucune limite de visionnage', free: false, vip: true },
];

const FAQ = [
  {
    q: 'Comment fonctionne le compte gratuit et la remise à zéro ?',
    a: `Chaque compte gratuit dispose de ${MAX_FREE_LIMIT} visions par semaine. Une vision est comptée à chaque lancement de film ou d'épisode. Le compteur se remet automatiquement à zéro chaque semaine. Si tu as atteint ta limite, tu peux attendre le compte à rebours ou passer VIP.`,
  },
  {
    q: 'Quand mon accès VIP est-il activé ?',
    a: "Juste après la validation du paiement : tu es redirigé vers une page qui active ton compte VIP, puis vers l'accueil.",
  },
  {
    q: "J'ai payé mais je ne suis pas VIP, que faire ?",
    a: "Contacte-nous depuis la section Signalement en bas de page, avec ton identifiant client et ton reçu Stripe : on vérifie ton paiement et on active ton accès.",
  },
  {
    q: 'Quelle différence entre les forfaits ?',
    a: "Seule la durée change : les avantages VIP sont exactement les mêmes. Plus le forfait est long, moins il revient cher par mois.",
  },
  {
    q: 'Le paiement est-il sécurisé ?',
    a: "Oui. Le paiement est entièrement géré par Stripe : tes informations bancaires ne passent jamais par notre site.",
  },
  {
    q: 'Dois-je utiliser le même email pour payer ?',
    a: "Oui, utilise l'adresse email de ton compte pour que l'abonnement soit bien associé à ton profil. Elle est pré-remplie automatiquement.",
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AbonnementPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [watchCount, setWatchCount] = useState(0);
  const [vipStartedAt, setVipStartedAt] = useState<string | undefined>(undefined);
  const [vipDuration, setVipDuration] = useState<VipDurationType | undefined>(undefined);

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_PLAN_ID);
  const [copied, setCopied] = useState(false);
  const [reviewsList, setReviewsList] = useState<Review[]>(INITIAL_REVIEWS);
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewName, setNewReviewName] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const selectedPlan = PLANS.find(p => p.id === selectedPlanId) || PLANS[0];

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    const user = session.user;
    setUserId(user.id);
    setUserEmail(user.email || null);

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_vip, watch_count, vip_started_at, vip_duration')
      .eq('id', user.id)
      .single();

    const adminCheck = user.email === ADMIN_EMAIL;
    setIsVip(adminCheck || (profile ? !!profile.is_vip : false));
    setWatchCount(profile ? profile.watch_count || 0 : 0);
    setVipStartedAt(profile?.vip_started_at || undefined);
    setVipDuration(profile?.vip_duration || undefined);
  };

  useEffect(() => {
    loadProfile()
      .catch(err => console.error('Erreur chargement VIP:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = (plan: Plan) => {
    if (!plan.stripeLink) return;
    const url = new URL(plan.stripeLink);
    if (userEmail) url.searchParams.set('prefilled_email', userEmail);
    if (userId) url.searchParams.set('client_reference_id', userId);
    window.location.href = url.toString();
  };

  const copyUserId = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewText.trim()) return;

    const reviewToAdd: Review = {
      id: Date.now().toString(),
      name: newReviewName.trim() || userEmail?.split('@')[0] || 'Utilisateur',
      rating: newReviewRating,
      comment: newReviewText.trim(),
      date: 'À l’instant',
    };

    setReviewsList([reviewToAdd, ...reviewsList]);
    setNewReviewText('');
    setNewReviewName('');
    setReviewSubmitted(true);
    setTimeout(() => setReviewSubmitted(false), 3000);
  };

  const remaining = Math.max(0, MAX_FREE_LIMIT - watchCount);
  const usedPct = Math.min(100, (watchCount / MAX_FREE_LIMIT) * 100);
  const limitReached = !isVip && watchCount >= MAX_FREE_LIMIT;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] text-white">
        <div className="mx-auto max-w-5xl space-y-6 px-4 pt-28 sm:px-10">
          <div className="mx-auto h-6 w-32 animate-pulse rounded-full bg-zinc-800" />
          <div className="mx-auto h-12 w-2/3 animate-pulse rounded-xl bg-zinc-800" />
          <div className="mx-auto h-4 w-1/2 animate-pulse rounded bg-zinc-900" />
          <div className="grid gap-4 pt-8 md:grid-cols-3">
            <div className="h-96 animate-pulse rounded-3xl bg-zinc-900" />
            <div className="h-96 animate-pulse rounded-3xl bg-zinc-900" />
            <div className="h-96 animate-pulse rounded-3xl bg-zinc-900" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0a0a0b] pb-24 font-sans text-white antialiased selection:bg-amber-500 selection:text-black">
      <div className="pointer-events-none absolute -top-56 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-amber-500/15 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-200px] top-[400px] h-[400px] w-[400px] rounded-full bg-red-600/10 blur-[120px]" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#0a0a0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-10">
          <button
            onClick={() => router.push('/')}
            className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 py-2 pl-3 pr-4 text-sm font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="back" className="h-4 w-4 transition group-hover:-translate-x-0.5" />
            Accueil
          </button>
          <button
            onClick={() => router.push('/')}
            className="cursor-pointer select-none text-lg font-black tracking-[0.2em] text-red-600"
          >
            YAMON<span className="text-white">FIM</span>
          </button>
          <span
            className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 sm:flex ${
              isVip
                ? 'bg-amber-500/15 text-amber-300 ring-amber-500/30'
                : 'bg-white/5 text-zinc-400 ring-white/10'
            }`}
          >
            <Icon name={isVip ? 'crown' : 'lock'} className="h-3.5 w-3.5" />
            {isVip ? 'Membre VIP' : 'Compte gratuit'}
          </span>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-4 pt-28 sm:px-10 sm:pt-32">

        {isVip ? (
          <section className="mx-auto max-w-xl text-center">
            <div className="relative mx-auto mb-6 w-fit">
              <div className="absolute inset-0 rounded-3xl bg-amber-500/40 blur-2xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-zinc-950 shadow-2xl">
                <Icon name="crown" className="h-10 w-10" />
              </div>
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-amber-400">Membre VIP</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Tu profites de tout, sans limite.</h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
              Ton compte <span className="text-white">{userEmail}</span> possède un accès illimité actif.
            </p>

            <div className="mt-8">
              <VipCountdownClient startDate={vipStartedAt} duration={vipDuration} />
            </div>

            <div className="mx-auto mt-10 grid max-w-xl gap-3 text-left sm:grid-cols-2">
              {PERKS.map(p => (
                <div key={p.title} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                    <Icon name={p.icon} />
                  </span>
                  <span className="text-sm font-medium">{p.title}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={() => router.push('/')}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-black transition hover:bg-zinc-200 active:scale-[0.98]"
              >
                <Icon name="play" /> Continuer à regarder
              </button>
              {STRIPE_PORTAL_URL && (
                <a
                  href={STRIPE_PORTAL_URL}
                  className="inline-flex items-center gap-2 rounded-full bg-white/5 px-6 py-3.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                >
                  <Icon name="card" /> Gérer mon abonnement
                </a>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-400 ring-1 ring-amber-500/30">
                <Icon name="crown" className="h-3.5 w-3.5" /> YAMONFIM VIP
              </span>
              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
                Regarde sans limite.
                <br />
                <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600 bg-clip-text text-transparent">
                  Passe au VIP.
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                Débloque l'accès illimité à tous les films et toutes les séries, sur tous tes écrans. Dès {formatEuro(PLANS[0].price)}.
              </p>
              <a href="#aide" className="mt-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 underline-offset-4 transition hover:text-white hover:underline">
                <Icon name="help" className="h-4 w-4" /> Déjà payé mais pas VIP ?
              </a>
            </section>

            <section className="mx-auto mt-10 max-w-md">
              <div className={`rounded-2xl p-5 ring-1 ${limitReached ? 'bg-red-600/10 ring-red-500/30' : 'bg-white/[0.04] ring-white/10'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-300">Tes visions gratuites</span>
                  <span className="text-sm font-bold tabular-nums">
                    {Math.min(watchCount, MAX_FREE_LIMIT)}<span className="text-zinc-500">/{MAX_FREE_LIMIT}</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      limitReached ? 'bg-red-600' : 'bg-gradient-to-r from-amber-400 to-amber-600'
                    }`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className={`mt-3 text-xs ${limitReached ? 'text-red-300' : 'text-zinc-500'}`}>
                  {limitReached
                    ? 'Limite atteinte : passe au VIP ou attends la remise à zéro ci-dessous.'
                    : `Il te reste ${remaining} vision${remaining > 1 ? 's' : ''} gratuite${remaining > 1 ? 's' : ''} cette semaine.`}
                </p>

                {/* Compte à rebours avant remise à zéro */}
                <WeeklyResetCountdown />
              </div>
            </section>

            <section className="mx-auto mt-14 max-w-5xl">
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Choisis ton forfait</h2>
                <p className="mt-2 text-sm text-zinc-400">Les mêmes avantages VIP, seule la durée change.</p>
              </div>

              <div className="grid items-stretch gap-5 md:grid-cols-3" role="radiogroup" aria-label="Forfaits VIP">
                {PLANS.map(plan => {
                  const selected = plan.id === selectedPlanId;
                  const saving = savingPct(plan);
                  const available = !!plan.stripeLink;
                  return (
                    <div
                      key={plan.id}
                      role="radio"
                      aria-checked={selected}
                      tabIndex={0}
                      onClick={() => setSelectedPlanId(plan.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedPlanId(plan.id);
                        }
                      }}
                      className={`relative flex cursor-pointer flex-col rounded-3xl p-7 transition duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/40 ${
                        selected
                          ? 'bg-gradient-to-b from-amber-500/15 via-[#141210] to-[#111113] ring-2 ring-amber-400 shadow-[0_0_100px_-30px_rgba(245,158,11,0.55)] md:-translate-y-2'
                          : 'bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.05] hover:ring-white/20'
                      }`}
                    >
                      {plan.badge && (
                        <span
                          className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                            plan.badge === 'Meilleure offre'
                              ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-zinc-950'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {plan.badge}
                        </span>
                      )}

                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wider ${selected ? 'text-amber-400' : 'text-zinc-400'}`}>
                            <Icon name="crown" className="h-4 w-4" /> VIP {plan.name}
                          </p>
                          <p className="mt-1 text-sm text-zinc-500">{plan.tagline}</p>
                        </div>
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 transition ${
                            selected ? 'bg-amber-400 text-zinc-950 ring-amber-400' : 'ring-white/20'
                          }`}
                        >
                          {selected && <Icon name="check" className="h-3.5 w-3.5" />}
                        </span>
                      </div>

                      <div className="mt-6">
                        <p className="flex items-baseline gap-1.5">
                          <span className="text-5xl font-black tracking-tight">{formatEuro(plan.price)}</span>
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">pour {plan.name}</p>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-white/10">
                          ≈ {formatEuro(Math.round(perMonth(plan) * 100) / 100)} / mois
                        </span>
                        {saving > 0 && (
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                            −{saving} %
                          </span>
                        )}
                      </div>

                      <ul className="mt-6 flex-1 space-y-3 border-t border-white/5 pt-6">
                        {['Visionnage illimité', 'Tout le catalogue', 'Mobile, PC, tablette et TV', `Accès pendant ${plan.name}`].map(f => (
                          <li key={f} className="flex items-center gap-3 text-sm text-zinc-200">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-zinc-400'}`}>
                              <Icon name="check" className="h-3 w-3" />
                            </span>
                            {f}
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedPlanId(plan.id);
                          handleSubscribe(plan);
                        }}
                        disabled={!available}
                        className={`mt-8 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${
                          selected
                            ? 'cursor-pointer bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 shadow-lg shadow-amber-500/25 hover:from-amber-300 hover:to-amber-400'
                            : 'cursor-pointer bg-white/10 text-white hover:bg-white/15'
                        }`}
                      >
                        {available ? <><Icon name="crown" /> Choisir ce forfait</> : 'Bientôt disponible'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                <Icon name="shield" className="h-3.5 w-3.5" /> Paiement sécurisé par Stripe · Activation immédiate
              </p>
            </section>

            {/* Section Avis Utilisateurs */}
            <section className="mx-auto mt-24 max-w-4xl">
              <div className="text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 ring-1 ring-amber-500/30">
                  <Icon name="star" className="h-3.5 w-3.5" /> Témoignages
                </span>
                <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Avis de nos utilisateurs</h2>
                <p className="mt-2 text-sm text-zinc-400">Découvre ce que pensent la communauté et nos membres VIP.</p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {reviewsList.map(review => (
                  <div key={review.id} className="flex flex-col justify-between rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
                    <div>
                      <div className="mb-2 flex items-center gap-1 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Icon key={i} name="star" className={`h-4 w-4 ${i < review.rating ? 'text-amber-400' : 'text-zinc-700'}`} />
                        ))}
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-300">« {review.comment} »</p>
                    </div>
                    <div className="mt-4 border-t border-white/5 pt-3 flex items-center justify-between text-xs text-zinc-500">
                      <span className="font-semibold text-zinc-300">{review.name}</span>
                      <span>{review.date}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Formulaire pour ajouter un avis */}
              <form onSubmit={handleAddReview} className="mt-8 rounded-2xl bg-white/[0.02] p-6 ring-1 ring-white/10">
                <h3 className="mb-4 text-sm font-bold text-white">Donne ton avis sur YAMONFIM</h3>
                {reviewSubmitted && (
                  <p className="mb-4 text-xs font-semibold text-emerald-400">Merci ! Ton avis a été ajouté.</p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Ton prénom / pseudo (optionnel)"
                    value={newReviewName}
                    onChange={e => setNewReviewName(e.target.value)}
                    className="rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-sm text-white outline-none focus:border-amber-400"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Note :</span>
                    <select
                      value={newReviewRating}
                      onChange={e => setNewReviewRating(Number(e.target.value))}
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
                    >
                      <option value={5}>5 / 5 ⭐⭐⭐⭐⭐</option>
                      <option value={4}>4 / 5 ⭐⭐⭐⭐</option>
                      <option value={3}>3 / 5 ⭐⭐⭐</option>
                    </select>
                  </div>
                </div>
                <textarea
                  rows={3}
                  required
                  placeholder="Écris ton commentaire ici..."
                  value={newReviewText}
                  onChange={e => setNewReviewText(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 p-3.5 text-sm text-white outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="mt-3 cursor-pointer rounded-full bg-white px-5 py-2 text-xs font-bold text-black hover:bg-zinc-200"
                >
                  Publier mon avis
                </button>
              </form>
            </section>

            <section className="mx-auto mt-24 max-w-2xl">
              <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Questions fréquentes</h2>
              <div className="mt-8 space-y-3">
                {FAQ.map((item, i) => {
                  const open = openFaq === i;
                  return (
                    <div key={item.q} className={`overflow-hidden rounded-2xl ring-1 transition ${open ? 'bg-white/[0.05] ring-white/15' : 'bg-white/[0.02] ring-white/10'}`}>
                      <button
                        onClick={() => setOpenFaq(open ? null : i)}
                        aria-expanded={open}
                        className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold"
                      >
                        {item.q}
                        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                      </button>
                      <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                        <div className="overflow-hidden">
                          <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-400">{item.a}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <section id="aide" className="mx-auto mt-24 max-w-4xl scroll-mt-24">
          <div className="text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-300 ring-1 ring-white/10">
              <Icon name="help" className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Un problème avec ton paiement ou ton compte ?</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400">
              Tu as payé mais ton VIP ne s'active pas, ou tu souhaites signaler un problème ?
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-md">
            <div className="flex flex-col rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                <Icon name="alert" className="h-5 w-5" />
              </span>
              <h3 className="font-semibold">Signaler un problème / Idée</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-400">
                Redirige directement vers notre formulaire de signalement pour nous transmettre un problème ou une suggestion.
              </p>
              <button
                onClick={() => router.push('/report')}
                className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-500"
              >
                <Icon name="alert" /> Aller sur la page Report
              </button>
            </div>
          </div>

          {userId && (
            <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">À indiquer dans ton message</p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">Email du compte</p>
                  <p className="truncate font-medium text-white">{userEmail}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">Identifiant client</p>
                  <div className="flex items-center gap-2">
                    <code className="truncate font-mono text-xs text-zinc-300">{userId}</code>
                    <button
                      onClick={copyUserId}
                      aria-label="Copier l'identifiant"
                      className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                        copied ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" />
                      {copied ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}