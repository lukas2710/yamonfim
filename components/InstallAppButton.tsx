'use client';
import { useEffect, useState } from 'react';

// Chrome, Edge et Samsung Internet : fenêtre d'installation native, déclenchée par notre bouton.
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS se présente comme un Mac, mais avec un écran tactile.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return /Android/.test(ua) ? 'android' : 'desktop';
}

const STEPS: Record<Platform, string[]> = {
  ios: [
    'Ouvre cette page dans Safari.',
    'Appuie sur le bouton Partager (le carré avec une flèche vers le haut), en bas de l’écran.',
    'Fais défiler et choisis « Sur l’écran d’accueil ».',
    'Appuie sur « Ajouter » : l’icône YAMONFILM apparaît avec tes autres applications.',
  ],
  android: [
    'Ouvre le menu du navigateur (les trois points ⋮ en haut à droite).',
    'Choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».',
    'Confirme : l’icône YAMONFILM apparaît avec tes autres applications.',
  ],
  desktop: [
    'Dans Chrome ou Edge, clique sur l’icône d’installation à droite de la barre d’adresse.',
    'Ou ouvre le menu ⋮ → « Installer YAMONFILM ».',
  ],
};

export default function InstallAppButton() {
  const [platform, setPlatform] = useState<Platform>('android');
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The platform is only known in the browser.
    setPlatform(detectPlatform());
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { /* l'aide manuelle reste disponible */ });
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setHelp(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const install = async () => {
    if (!prompt) { setHelp(true); return; }
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === 'accepted') setInstalled(true);
  };

  if (installed) {
    return <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30">✓ YAMONFILM est installé sur cet appareil</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-3 whitespace-nowrap rounded-full bg-white px-8 py-4 sm:w-auto text-lg font-bold text-black transition hover:bg-zinc-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M12 7v7m0 0-3-3m3 3 3-3M10 18h4" /></svg>
        Installer sur mon téléphone
      </button>

      {help && (
        <div role="dialog" aria-modal="true" aria-labelledby="install-help-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setHelp(false)}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#11131a] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- Icône locale, déjà à la bonne taille. */}
              <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
              <div>
                <h2 id="install-help-title" className="text-lg font-bold text-white">Ajouter YAMONFILM à l’écran d’accueil</h2>
                <p className="text-sm text-zinc-400">{platform === 'ios' ? 'iPhone et iPad' : platform === 'android' ? 'Android' : 'Ordinateur'}</p>
              </div>
            </div>
            <ol className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
              {STEPS[platform].map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-xs font-bold text-red-400">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setHelp(false)} className="mt-6 w-full cursor-pointer rounded-full bg-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
              J’ai compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
