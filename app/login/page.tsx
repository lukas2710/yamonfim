'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPersistentSession } from '@/lib/auth-session';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/* Icônes SVG (aucune dépendance)                                      */
/* ------------------------------------------------------------------ */

type IconName =
  | 'mail' | 'lock' | 'eye' | 'eyeOff' | 'close' | 'alert' | 'check'
  | 'download' | 'share' | 'plusSquare' | 'arrowRight' | 'play' | 'tv' | 'sparkles';

const ICONS: Record<IconName, React.ReactNode> = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></>,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  download: <><path d="M12 3v12m0 0-4-4m4 4 4-4" /><path d="M5 21h14" /></>,
  share: <><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>,
  plusSquare: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></>,
  arrowRight: <path d="M5 12h14m-6-7 7 7-7 7" />,
  play: <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor" stroke="none" />,
  tv: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="m8 2 4 4 4-4" /></>,
  sparkles: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />,
};

function Icon({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// Traduit les erreurs Supabase les plus courantes à l'inscription
const translateSignUpError = (message: string) => {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists')) return 'Un compte existe déjà avec cet email.';
  if (m.includes('password should be') || m.includes('at least')) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (m.includes('invalid') && m.includes('email')) return "L'adresse email n'est pas valide.";
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  return message;
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    const restore = () => { void getPersistentSession().then(({ data: { session } }) => {
      if (!alive) return;
      if (!session) { setCheckingSession(false); return; }
      let destination = '/profiles';
      try {
        const profile = JSON.parse(localStorage.getItem('active_profile') || 'null');
        if (profile?.id && profile.user_id === session.user.id) destination = '/';
      } catch { /* An invalid profile does not invalidate the account session. */ }
      router.replace(destination);
    }).catch(() => {
      if (alive) { setCheckingSession(false); setErrorMsg('La connexion enregistrée ne peut pas être vérifiée pour le moment. Vérifie ta connexion Internet puis réessaie.'); }
    }); };
    restore();
    window.addEventListener('online', restore);
    window.addEventListener('pageshow', restore);
    return () => { alive = false; window.removeEventListener('online', restore); window.removeEventListener('pageshow', restore); };
  }, [router]);

  // Pop-up d'installation
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    // Bug corrigé : ne pas proposer l'installation si l'app est déjà installée/ouverte en mode app
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;


    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  // Échap ferme le pop-up
  useEffect(() => {
    if (!showInstallModal) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeInstallModal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showInstallModal]);

  const closeInstallModal = () => {
    setShowInstallModal(false);
    setShowInstallHelp(false);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Pop-up native d'installation (Android / PC)
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      // Bug corrigé : le prompt du navigateur n'est utilisable qu'une seule fois
      setDeferredPrompt(null);
      if (outcome === 'accepted') closeInstallModal();
    } else {
      // Remplace l'ancien alert() par des instructions dans le pop-up
      setShowInstallHelp(true);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const cleanEmail = email.trim();

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (error) {
          setErrorMsg(translateSignUpError(error.message));
        } else {
          setSuccessMsg('Compte créé avec succès ! Vérifie ton adresse email si une confirmation est demandée.');
          setIsSignUp(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setErrorMsg('Email ou mot de passe incorrect.');
        } else {
          localStorage.removeItem('active_profile');
          router.push('/profiles');
        }
      }
    } catch {
      setErrorMsg('Une erreur est survenue. Réessaie dans quelques instants.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-red-600/70 focus:bg-white/[0.06] focus:ring-4 focus:ring-red-600/15';

  if (checkingSession) return <main className="yf-page yf-auth flex min-h-screen items-center justify-center bg-[#0a0a0b] px-6 text-white"><p role="status" className="text-sm text-zinc-400">Reprise de ta connexion…</p></main>;

  return (
    <main className="yf-page yf-auth relative flex min-h-screen overflow-hidden bg-[#0a0a0b] font-sans text-white antialiased selection:bg-red-600 selection:text-white">

      {/* ================= Pop-up d'installation ================= */}
      {showInstallModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-md sm:items-center"
          onClick={closeInstallModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#111113] shadow-2xl animate-[popIn_.25s_ease-out]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-red-600/15 to-transparent" />
            <button
              onClick={closeInstallModal}
              aria-label="Fermer"
              className="absolute right-4 top-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            >
              <Icon name="close" />
            </button>

            <div className="relative p-7 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 shadow-lg shadow-red-600/30">
                <span className="text-xl font-black tracking-tighter">
                  Y<span className="text-red-200">F</span>
                </span>
              </div>

              <h3 className="mb-1.5 text-xl font-bold tracking-tight">Installer YAMONFIM</h3>
              <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                Ajoute l'application sur ton appareil pour le plein écran et un accès en un clic.
              </p>

              {showInstallHelp ? (
                <div className="mb-5 space-y-2.5 text-left">
                  <div className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                      <Icon name="share" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">iPhone / iPad</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                        Touche <span className="text-white">Partager</span> puis{' '}
                        <span className="text-white">Sur l'écran d'accueil</span>.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                      <Icon name="tv" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">TV / Autre</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                        Ajoute le site aux <span className="text-white">favoris</span> de ton navigateur.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <ul className="mb-6 space-y-2 text-left">
                  {['Lecture en plein écran', 'Ouverture instantanée', 'Aucun téléchargement lourd'].map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-zinc-300">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600/15 text-red-500">
                        <Icon name="check" className="h-3 w-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              )}

              {!showInstallHelp && (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="yf-primary mb-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-red-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 active:scale-[0.98]"
                >
                  <Icon name="download" /> Installer maintenant
                </button>
              )}

              <button
                type="button"
                onClick={closeInstallModal}
                className="w-full cursor-pointer py-2 text-sm text-zinc-500 transition hover:text-white"
              >
                {showInstallHelp ? "J'ai compris" : 'Plus tard'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= Panneau visuel (ordinateur) ================= */}
      <aside className="relative hidden flex-1 overflow-hidden lg:flex">
        {/* Fond décoratif : grille d'affiches stylisées */}
        <div className="absolute inset-0 grid -rotate-6 scale-125 grid-cols-5 gap-4 opacity-40">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-xl"
              style={{
                background: `linear-gradient(${(i * 47) % 360}deg, hsl(${(i * 23) % 40}, 70%, ${12 + (i % 5) * 4}%), hsl(${350 + (i % 3) * 5}, 60%, ${6 + (i % 4) * 3}%))`,
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0b]/40 via-[#0a0a0b]/70 to-[#0a0a0b]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-transparent to-[#0a0a0b]/60" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16">
          <span className="select-none text-2xl font-black tracking-[0.2em] text-red-600">
            YAMON<span className="text-white">FIM</span>
          </span>

          <div className="max-w-lg">
            <h2 className="text-5xl font-black leading-[1.05] tracking-tight xl:text-6xl">
              Tes films et séries,
              <br />
              <span className="bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">
                au même endroit.
              </span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-zinc-400">
              Reprends là où tu t'étais arrêté, sur ton téléphone, ton ordinateur ou ta TV.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {[
                { icon: 'play' as IconName, label: 'Films & séries' },
                { icon: 'tv' as IconName, label: 'Mobile, PC & TV' },
                { icon: 'sparkles' as IconName, label: 'Inscription gratuite' },
              ].map(f => (
                <span key={f.label} className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-zinc-300 ring-1 ring-white/10 backdrop-blur">
                  <Icon name={f.icon} className="h-4 w-4 text-red-500" /> {f.label}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} YAMONFIM</p>
        </div>
      </aside>

      {/* ================= Formulaire ================= */}
      <section className="yf-auth-form relative flex w-full items-center justify-center px-4 py-10 lg:w-[520px] lg:shrink-0 lg:border-l lg:border-white/5 lg:bg-[#0d0d0f]">
        {/* Halo rouge */}
        <div className="pointer-events-none absolute -top-48 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-red-600/15 blur-[130px] lg:hidden" />

        <div className="relative w-full max-w-[400px]">
          {/* Logo (mobile/tablette) */}
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-4xl font-black tracking-[0.15em] sm:text-5xl">
              <span className="text-red-600">YAMON</span>
              <span className="text-white">FIM</span>
            </h1>
            <p className="mt-2 text-xs uppercase tracking-[0.3em] text-zinc-500">
              Films · Séries · Divertissement
            </p>
          </div>

          {/* Onglets connexion / inscription */}
          <div className="mb-8 grid grid-cols-2 rounded-full bg-white/[0.04] p-1 ring-1 ring-white/10">
            {[
              { label: 'Connexion', active: !isSignUp },
              { label: 'Inscription', active: isSignUp },
            ].map(tab => (
              <button
                key={tab.label}
                type="button"
                onClick={() => !tab.active && switchMode()}
                className={`cursor-pointer rounded-full py-2.5 text-sm font-semibold transition ${
                  tab.active ? 'bg-white text-black shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Titre */}
          <div className="mb-7">
            <h2 className="text-3xl font-bold tracking-tight">
              {isSignUp ? 'Créer ton compte' : 'Bon retour !'}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {isSignUp
                ? 'Inscris-toi gratuitement en quelques secondes.'
                : 'Connecte-toi à ton compte pour continuer.'}
            </p>
          </div>

          {/* Bandeau gratuit (inscription) */}
          {isSignUp && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-red-600/20 to-red-600/5 p-4 ring-1 ring-red-600/30">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                <Icon name="sparkles" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold">Inscription 100 % gratuite</p>
                <p className="text-xs text-zinc-400">Aucun paiement nécessaire pour créer ton compte.</p>
              </div>
            </div>
          )}

          {/* Messages */}
          {errorMsg && (
            <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl bg-red-600/10 px-4 py-3 ring-1 ring-red-500/30">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm leading-relaxed text-red-300">{errorMsg}</p>
            </div>
          )}
          {successMsg && (
            <div role="status" className="mb-5 flex items-start gap-3 rounded-xl bg-emerald-500/10 px-4 py-3 ring-1 ring-emerald-500/30">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p className="text-sm leading-relaxed text-emerald-200">{successMsg}</p>
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleAuth} className="space-y-5" noValidate={false}>
            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Adresse email
              </label>
              <div className="relative">
                <Icon name="mail" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="ton@email.com"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Mot de passe
              </label>
              <div className="relative">
                <Icon name="lock" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>

              {isSignUp && (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        password.length >= 10 ? 'bg-emerald-500' : password.length >= 6 ? 'bg-amber-500' : 'bg-red-600'
                      }`}
                      style={{ width: `${Math.min(100, (password.length / 10) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-[11px] ${password.length >= 6 ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {password.length >= 6 ? 'OK' : 'Min. 6 caractères'}
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="yf-primary group flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-red-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-red-900/70 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {isSignUp ? 'Création du compte…' : 'Connexion…'}
                </>
              ) : (
                <>
                  {isSignUp ? 'Créer mon compte gratuitement' : 'Se connecter'}
                  <Icon name="arrowRight" className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Bascule */}
          <p className="mt-7 text-center text-sm text-zinc-500">
            {isSignUp ? 'Tu as déjà un compte ?' : "Tu n'as pas encore de compte ?"}{' '}
            <button
              type="button"
              onClick={switchMode}
              className="cursor-pointer font-semibold text-white underline-offset-4 transition hover:text-red-500 hover:underline"
            >
              {isSignUp ? 'Se connecter' : 'Créer un compte gratuitement'}
            </button>
          </p>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-zinc-600">
            En créant un compte, tu acceptes les <a href="/conditions" className="underline hover:text-zinc-300">conditions générales</a> et la <a href="/confidentialite" className="underline hover:text-zinc-300">politique de confidentialité</a>.
          </p>
        </div>
      </section>

      <style jsx global>{`
        @keyframes popIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </main>
  );
}
