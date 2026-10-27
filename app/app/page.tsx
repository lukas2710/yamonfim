import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Application TV — YAMONFILM',
  description: 'Installe YAMONFILM sur ta télévision Android TV, Google TV, Fire TV ou décodeur Bbox.',
};

const APK = '/yamonfilm-tv.apk';
const VERSION = '2.4.2';

const GUIDES = [
  {
    title: 'Fire TV Stick (Amazon)',
    steps: [
      'Paramètres → Ma Fire TV → À propos : clique 7 fois sur le nom de l’appareil pour activer les options pour les développeurs.',
      'Installe l’application « Downloader » depuis l’Appstore Amazon.',
      'Paramètres → Ma Fire TV → Options pour les développeurs → Installer des applications inconnues : active Downloader.',
      'Ouvre Downloader et tape l’adresse : yamonfi.netlify.app/yamonfilm-tv.apk',
      'Installe, puis ouvre YAMONFILM depuis « Vos applications ».',
    ],
  },
  {
    title: 'Android TV et Google TV (TCL, Sony, Philips, Xiaomi…)',
    steps: [
      'Installe un navigateur depuis le Play Store de la TV (par exemple « TV Bro ») ou l’application « Downloader ».',
      'Ouvre yamonfi.netlify.app/app et appuie sur « Télécharger l’application ».',
      'Si Android le demande, autorise l’installation pour ce navigateur (« Sources inconnues »).',
      'Installe, puis ouvre YAMONFILM depuis la liste des applications.',
    ],
  },
  {
    title: 'Décodeur Bbox (Bouygues)',
    steps: [
      'Nécessite Android TV 8 ou plus. La compatibilité du lecteur dépend du modèle de la box et doit être vérifiée sur l’appareil.',
      'Paramètres → Préférences de l’appareil → À propos : clique 7 fois sur « Build », puis autorise les sources inconnues.',
      'Suis ensuite les étapes Android TV ci-dessus, ou copie le fichier sur une clé USB et ouvre-le avec un gestionnaire de fichiers.',
    ],
  },
];

export default function TvAppPage() {
  return (
    <main className="min-h-screen bg-[#07080c] text-white">
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-10 sm:px-10">
        <p className="text-xs font-semibold tracking-[0.25em] text-red-500">APPLICATION TV</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
          YAMON<span className="text-red-600">FILM</span> sur ta télé
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
          Tes films et séries sur grand écran, pilotés à la télécommande. Même compte, mêmes profils, même historique et même accès VIP que sur le site.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <a
            href={APK}
            download="YAMONFILM-TV.apk"
            className="inline-flex items-center justify-center gap-3 rounded-full bg-red-600 px-8 py-4 text-lg font-bold text-white transition hover:bg-red-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16" /></svg>
            Télécharger l’application
          </a>
          <p className="text-sm text-zinc-400">Version {VERSION} · Android TV 8 ou plus · environ 1 Mo</p>
        </div>
        <p className="mt-6 text-sm text-zinc-500">
          Sur la télé, tape simplement : <span className="font-mono text-zinc-200">yamonfi.netlify.app/app</span>
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 px-6 pb-16 sm:px-10 md:grid-cols-3">
        {GUIDES.map(guide => (
          <article key={guide.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-bold">{guide.title}</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
              {guide.steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-xs font-bold text-red-400">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20 sm:px-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm leading-6 text-zinc-400">
          <p><strong className="text-white">Mise à jour :</strong> télécharge à nouveau le fichier et installe-le par-dessus l’ancienne version. Tes profils et ta connexion sont conservés.</p>
          <p className="mt-2"><strong className="text-white">Sécurité :</strong> Android demande d’autoriser les « sources inconnues » à la première installation. C’est normal pour une application installée hors du Play Store.</p>
        </div>
      </section>
    </main>
  );
}
