'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setErrorMsg(error.message);
        } else {
          alert(
            'Compte créé avec succès ! Vérifie ton adresse email si une confirmation est demandée.'
          );
          setIsSignUp(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMsg('Email ou mot de passe incorrect.');
        } else {
          router.push('/');
        }
      }
    } catch (error) {
      setErrorMsg('Une erreur est survenue. Réessaie dans quelques instants.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#141414] text-white flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Lumière rouge en arrière-plan */}
      <div className="absolute top-[-180px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-red-600/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-[430px]">
        {/* Logo */}
        <div className="text-center mb-7">
          <h1 className="text-4xl sm:text-5xl font-black tracking-[-2px]">
            <span className="text-red-600">YAMON</span>
            <span className="text-white">FIM</span>
          </h1>

          <p className="text-zinc-500 text-xs mt-2">
            Films • Séries • Divertissement
          </p>
        </div>

        {/* Carte principale */}
        <div className="bg-[#1b1b1b] border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden">
          {/* Bandeau gratuit */}
          <div className="bg-red-600 px-5 py-3 text-center">
            <p className="text-sm font-black uppercase tracking-wide">
              ✦ Inscription 100 % gratuite ✦
            </p>
            <p className="text-[11px] text-red-100 mt-0.5">
              Aucun paiement nécessaire pour créer ton compte
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {/* Titre */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold">
                {isSignUp ? 'Créer ton compte' : 'Bienvenue !'}
              </h2>

              <p className="text-sm text-zinc-500 mt-2">
                {isSignUp
                  ? 'Inscris-toi gratuitement en quelques secondes.'
                  : 'Connecte-toi à ton compte pour continuer.'}
              </p>
            </div>

            {/* Erreur */}
            {errorMsg && (
              <div className="mb-5 bg-red-600/10 border border-red-500/30 rounded-xl px-4 py-3">
                <div className="flex gap-2 items-start">
                  <span className="text-red-500 text-sm">⚠</span>
                  <p className="text-red-400 text-xs leading-5">
                    {errorMsg}
                  </p>
                </div>
              </div>
            )}

            {/* Formulaire */}
            <form onSubmit={handleAuth} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Adresse email
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
                    @
                  </span>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="ton@email.com"
                    className="
                      w-full
                      bg-[#111111]
                      border border-zinc-800
                      rounded-xl
                      pl-10 pr-4 py-3.5
                      text-sm text-white
                      placeholder:text-zinc-700
                      outline-none
                      transition
                      focus:border-red-600
                      focus:ring-1
                      focus:ring-red-600
                    "
                  />
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Mot de passe
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
                    •
                  </span>

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={
                      isSignUp ? 'new-password' : 'current-password'
                    }
                    placeholder="••••••••"
                    className="
                      w-full
                      bg-[#111111]
                      border border-zinc-800
                      rounded-xl
                      pl-10 pr-4 py-3.5
                      text-sm text-white
                      placeholder:text-zinc-700
                      outline-none
                      transition
                      focus:border-red-600
                      focus:ring-1
                      focus:ring-red-600
                    "
                  />
                </div>

                {isSignUp && (
                  <p className="text-[10px] text-zinc-600 mt-2">
                    Minimum 6 caractères
                  </p>
                )}
              </div>

              {/* Bouton */}
              <button
                type="submit"
                disabled={loading}
                className="
                  w-full
                  bg-red-600
                  hover:bg-red-500
                  active:bg-red-700
                  disabled:bg-red-900
                  disabled:cursor-not-allowed
                  text-white
                  font-bold
                  py-3.5
                  rounded-xl
                  text-sm
                  transition
                  shadow-lg
                  shadow-red-600/20
                  cursor-pointer
                "
              >
                {loading
                  ? 'Chargement...'
                  : isSignUp
                  ? 'Créer mon compte gratuitement'
                  : 'Se connecter'}
              </button>
            </form>

            {/* Séparateur */}
            <div className="flex items-center gap-3 my-7">
              <div className="h-px bg-zinc-800 flex-1" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                ou
              </span>
              <div className="h-px bg-zinc-800 flex-1" />
            </div>

            {/* Switch connexion / inscription */}
            <div className="text-center">
              <p className="text-xs text-zinc-500 mb-3">
                {isSignUp
                  ? 'Tu as déjà un compte ?'
                  : "Tu n'as pas encore de compte ?"}
              </p>

              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrorMsg('');
                }}
                className="
                  w-full
                  border
                  border-zinc-800
                  hover:border-red-600
                  hover:bg-red-600/5
                  text-zinc-300
                  hover:text-white
                  font-semibold
                  py-3
                  rounded-xl
                  text-xs
                  transition
                  cursor-pointer
                "
              >
                {isSignUp
                  ? 'Se connecter'
                  : 'Créer un compte gratuitement'}
              </button>
            </div>
          </div>
        </div>

        {/* Bas de page */}
        <p className="text-center text-[10px] text-zinc-700 mt-6">
          En créant un compte, tu acceptes les conditions d'utilisation du site.
        </p>
      </div>
    </main>
  );
}