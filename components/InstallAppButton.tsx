'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Fenêtre d'installation native d'Android (Chrome, Edge, Samsung Internet), gardée par public/install-capture.js.
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type YfWindow = Window & { __yfInstallPrompt?: InstallPrompt | null };
export type InstallPlatform = 'ios-safari' | 'ios-ipad' | 'ios-other' | 'in-app' | 'samsung' | 'android' | 'desktop';

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  // Instagram, Facebook, Snapchat, TikTok… : leur navigateur intégré ne sait pas installer de raccourci.
  if (/FBAN|FBAV|Instagram|Snapchat|musical_ly|TikTok|Line\//i.test(ua)) return 'in-app';
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ipad || /iPhone|iPod/.test(ua)) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : ipad ? 'ios-ipad' : 'ios-safari';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  return /Android/.test(ua) ? 'android' : 'desktop';
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Installation sur l'écran d'accueil : directe quand le navigateur le permet, sinon guide pas à pas. */
export function useInstallApp() {
  const [platform, setPlatform] = useState<InstallPlatform>('android');
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    const w = window as YfWindow;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The platform is only known in the browser.
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    setCanPrompt(!!w.__yfInstallPrompt);
    // Android sait dire si le raccourci est déjà sur l'écran d'accueil.
    const related = (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps;
    related?.call(navigator).then(apps => { if (apps.length) setInstalled(true); }).catch(() => { /* non pris en charge */ });
    const ready = () => setCanPrompt(!!w.__yfInstallPrompt);
    const done = () => { setInstalled(true); setCanPrompt(false); setGuide(false); };
    window.addEventListener('yf-install-ready', ready);
    window.addEventListener('yf-installed', done);
    return () => { window.removeEventListener('yf-install-ready', ready); window.removeEventListener('yf-installed', done); };
  }, []);

  const install = async () => {
    const w = window as YfWindow;
    const prompt = w.__yfInstallPrompt;
    if (!prompt) { setGuide(true); return; }
    // La fenêtre d'Android ne peut servir qu'une fois.
    w.__yfInstallPrompt = null;
    setCanPrompt(false);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
  };

  return { platform, canPrompt, installed, install, guide, closeGuide: () => setGuide(false) };
}

const Share = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>;
const PlusSquare = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></svg>;
const Dots = () => <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>;
const Burger = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-5 w-5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const Phone = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M10 18h4" /></svg>;
const Check = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="m5 12 5 5 9-10" /></svg>;
const Key = ({ children }: { children: ReactNode }) => <b className="whitespace-nowrap rounded-md bg-white/10 px-1.5 py-0.5 font-semibold text-white">{children}</b>;

type Step = { icon: ReactNode; text: ReactNode };
const GUIDES: Record<InstallPlatform, { title: string; arrow: 'bottom' | 'top-right' | 'bottom-right' | null; steps: Step[] }> = {
  'ios-safari': { title: 'Sur iPhone, ça se fait en 3 touches', arrow: 'bottom', steps: [
    { icon: <Share />, text: <>Appuie sur <Key>Partager</Key> dans la barre en bas de Safari (la flèche te le montre).</> },
    { icon: <PlusSquare />, text: <>Fais défiler et choisis <Key>Sur l’écran d’accueil</Key>.</> },
    { icon: <Check />, text: <>Appuie sur <Key>Ajouter</Key> en haut à droite. C’est fini : l’icône YAMONFILM est sur ton écran.</> },
  ] },
  'ios-ipad': { title: 'Sur iPad, ça se fait en 3 touches', arrow: 'top-right', steps: [
    { icon: <Share />, text: <>Appuie sur <Key>Partager</Key> en haut à droite de Safari.</> },
    { icon: <PlusSquare />, text: <>Choisis <Key>Sur l’écran d’accueil</Key>.</> },
    { icon: <Check />, text: <>Appuie sur <Key>Ajouter</Key>. L’icône YAMONFILM est sur ton écran.</> },
  ] },
  'ios-other': { title: 'Sur iPhone, ça se fait en 3 touches', arrow: 'top-right', steps: [
    { icon: <Share />, text: <>Appuie sur <Key>Partager</Key> à droite de la barre d’adresse.</> },
    { icon: <PlusSquare />, text: <>Choisis <Key>Sur l’écran d’accueil</Key> (fais défiler si besoin).</> },
    { icon: <Check />, text: <>Appuie sur <Key>Ajouter</Key>. Si l’option manque, ouvre cette page dans Safari.</> },
  ] },
  'in-app': { title: 'Ouvre d’abord la page dans ton navigateur', arrow: 'top-right', steps: [
    { icon: <Dots />, text: <>Tu es dans le navigateur d’une appli (Instagram, Facebook…), qui ne peut pas installer. Appuie sur <Key>•••</Key> en haut à droite.</> },
    { icon: <Phone />, text: <>Choisis <Key>Ouvrir dans le navigateur</Key> (Safari ou Chrome).</> },
    { icon: <Check />, text: <>Appuie de nouveau sur <Key>Installer sur mon téléphone</Key>.</> },
  ] },
  samsung: { title: 'Sur Samsung Internet, 3 touches', arrow: 'bottom-right', steps: [
    { icon: <Burger />, text: <>Appuie sur le menu <Key>≡</Key> en bas à droite.</> },
    { icon: <PlusSquare />, text: <>Choisis <Key>Ajouter page à</Key> puis <Key>Écran d’accueil</Key>.</> },
    { icon: <Check />, text: <>Confirme avec <Key>Ajouter</Key>. L’icône YAMONFILM est sur ton écran.</> },
  ] },
  android: { title: 'Sur Android, 3 touches', arrow: 'top-right', steps: [
    { icon: <Dots />, text: <>Appuie sur le menu <Key>⋮</Key> en haut à droite du navigateur.</> },
    { icon: <PlusSquare />, text: <>Choisis <Key>Installer l’application</Key> ou <Key>Ajouter à l’écran d’accueil</Key>.</> },
    { icon: <Check />, text: <>Confirme avec <Key>Installer</Key>. L’icône YAMONFILM est sur ton écran.</> },
  ] },
  desktop: { title: 'Sur ordinateur', arrow: 'top-right', steps: [
    { icon: <PlusSquare />, text: <>Dans Chrome ou Edge, clique sur l’icône d’installation à droite de la barre d’adresse.</> },
    { icon: <Dots />, text: <>Ou ouvre le menu <Key>⋮</Key> puis <Key>Installer YAMONFILM</Key>.</> },
    { icon: <Phone />, text: <>Sur ton téléphone, ouvre <Key>yamonfi.netlify.app/app</Key> et appuie sur le bouton : c’est encore plus simple.</> },
  ] },
};

const ARROW_POSITION = { bottom: 'bottom-3 left-1/2 -translate-x-1/2 rotate-180', 'top-right': 'top-3 right-4', 'bottom-right': 'bottom-3 right-4 rotate-180' } as const;

/** Guide visuel quand le navigateur ne permet pas l'installation en un clic (iPhone surtout : Apple l'interdit aux sites). */
export function InstallGuide({ platform, onClose }: { platform: InstallPlatform; onClose: () => void }) {
  const guide = GUIDES[platform];
  // Rendu au niveau de la page : une carte animée (transform) déplacerait sinon ce calque « fixed ».
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="install-guide-title" className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <style>{`@keyframes yfPoint{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@keyframes yfGuideIn{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:none}}@keyframes yfStepIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}`}</style>
      {guide.arrow && (
        <div className={`pointer-events-none fixed z-[301] ${ARROW_POSITION[guide.arrow]}`} aria-hidden="true">
          <div className="flex flex-col items-center text-white" style={{ animation: 'yfPoint 1s ease-in-out infinite' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 drop-shadow-[0_0_12px_rgba(229,9,20,.9)]"><path d="M12 20V4m0 0-6 6m6-6 6 6" /></svg>
          </div>
        </div>
      )}
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#11131a] p-6 text-left shadow-2xl" style={{ animation: 'yfGuideIn .4s cubic-bezier(.2,.9,.3,1.2) both' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- Icône locale, déjà à la bonne taille. */}
          <img decoding="async" src="/icons/icon-192.png" alt="" className="h-14 w-14 rounded-2xl shadow-lg" />
          <div>
            <h2 id="install-guide-title" className="text-lg font-bold leading-tight text-white">{guide.title}</h2>
            <p className="mt-0.5 text-sm text-zinc-400">L’icône YAMONFILM ira sur ton écran d’accueil, comme une vraie appli.</p>
          </div>
        </div>
        <ol className="mt-5 space-y-3">
          {guide.steps.map((step, index) => (
            <li key={index} className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3 text-sm leading-6 text-zinc-300" style={{ animation: `yfStepIn .4s ease ${0.15 + index * 0.12}s both` }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600/20 text-red-400">{step.icon}</span>
              <span><b className="mr-1 text-white">{index + 1}.</b>{step.text}</span>
            </li>
          ))}
        </ol>
        {platform.startsWith('ios') && <p className="mt-4 text-xs leading-5 text-zinc-500">Sur iPhone, Apple ne permet à aucun site d’ajouter son icône tout seul : ces 3 touches sont obligatoires.</p>}
        <button type="button" onClick={onClose} className="mt-5 w-full cursor-pointer rounded-full bg-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/15">J’ai compris</button>
      </div>
    </div>,
    document.body,
  );
}

export default function InstallAppButton() {
  const { platform, installed, install, guide, closeGuide } = useInstallApp();

  if (installed) {
    return <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30">✓ YAMONFILM est installé sur cet appareil</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-3 whitespace-nowrap rounded-full bg-white px-8 py-4 text-lg font-bold text-black transition hover:bg-zinc-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500 sm:w-auto"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M12 7v7m0 0-3-3m3 3 3-3M10 18h4" /></svg>
        Installer sur mon téléphone
      </button>
      {guide && <InstallGuide platform={platform} onClose={closeGuide} />}
    </div>
  );
}
