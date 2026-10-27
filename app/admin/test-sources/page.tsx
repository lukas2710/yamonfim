'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import WatchPlayer, { type WatchPlayerControl } from '@/components/WatchPlayer';
import { cataloguePlayer, primaryEmbed, isSupportedEmbed, type CatalogueSource } from '@/lib/catalogue-source';

export default function TestSources() {
  const [id, setId] = useState('542417');
  const [type, setType] = useState<'movie' | 'tv'>('movie');
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [embed, setEmbed] = useState('https://embedorigin.cc/e/h8jlblj2cx1u');
  const [test, setTest] = useState<{ source: CatalogueSource; skip: boolean; attempt: number; embed?: string } | null>(null);
  const [position, setPosition] = useState(0);
  const controls = useRef<WatchPlayerControl>(null);
  if (process.env.NODE_ENV !== 'development') return <p>Cette page de test est disponible uniquement en local.</p>;
  const launch = (skip: boolean) => {
    if (!/^\d{1,10}$/.test(id) || season < 1 || episode < 1) return;
    setPosition(0);
    setTest({ source: { id, type, season, episode }, skip, attempt: Date.now() });
  };
  return <main className="mx-auto max-w-5xl space-y-5 p-6 text-white">
    <Link href="/admin" className="text-red-400">← Administration</Link>
    <h1 className="text-2xl font-semibold">Test local des sources</h1>
    <p className="text-zinc-400">Connecte-toi au site avant le test. Cette page ne modifie pas le catalogue et n’enregistre pas l’historique de lecture.</p>
    <div className="flex flex-wrap items-end gap-4">
      <label>ID TMDb<input className="block rounded bg-zinc-800 p-2" value={id} onChange={event => setId(event.target.value)} inputMode="numeric" /></label>
      <label>Type<select className="block rounded bg-zinc-800 p-2" value={type} onChange={event => setType(event.target.value as 'movie' | 'tv')}><option value="movie">Film</option><option value="tv">Série</option></select></label>
      {type === 'tv' && <><label>Saison<input type="number" min="1" className="block w-24 rounded bg-zinc-800 p-2" value={season} onChange={event => setSeason(Number(event.target.value))} /></label><label>Épisode<input type="number" min="1" className="block w-24 rounded bg-zinc-800 p-2" value={episode} onChange={event => setEpisode(Number(event.target.value))} /></label></>}
      <button className="rounded bg-red-600 px-4 py-2" onClick={() => launch(false)}>Tester Moviez puis Movix</button>
      <button className="rounded bg-zinc-700 px-4 py-2" onClick={() => launch(true)}>Tester Movix sans Moviez</button>
    </div>
    <div className="flex flex-wrap items-end gap-4">
      <label className="grow">Lien embed compatible<input className="block w-full rounded bg-zinc-800 p-2" value={embed} onChange={event => setEmbed(event.target.value)} /></label>
      <button className="rounded bg-red-600 px-4 py-2" disabled={!isSupportedEmbed(embed)} onClick={() => { setPosition(0); setTest({ source: { id, type, season, episode }, skip: false, attempt: Date.now(), embed }); }}>Tester cet embed</button>
    </div>
    <p className="text-sm text-zinc-400">Le secours nécessite un embed proposant un flux HLS compatible. Un embed trouvé ne garantit pas que son flux peut être extrait.</p>
    {test && <><div className="relative aspect-video overflow-hidden rounded-xl bg-black"><WatchPlayer key={test.attempt} src={test.embed || cataloguePlayer(test.source)} title={test.embed ? 'Test EmbedOrigin' : `Test TMDb ${test.source.id}`} resumeAt={0} controlRef={controls} initialExcludedEmbeds={test.skip ? [primaryEmbed(test.source)] : []} onProgress={time => setPosition(time)} onState={() => {}} onEnded={() => {}} /></div><p className="text-sm text-zinc-400">Position de test : {Math.floor(position)} s</p><button className="rounded bg-zinc-700 px-4 py-2" onClick={() => controls.current?.simulateFailure?.()}>Simuler une panne du flux actuel</button><p className="text-sm text-zinc-400">La reprise nécessite une autre source compatible pour ce même film ou épisode.</p></>}
  </main>;
}
