export default function Loading() {
  return <main className="yf-page min-h-[70vh] bg-[#0a0a0b] px-6 py-20 text-white" aria-busy="true" aria-label="Ouverture de la page">
    <div className="mx-auto max-w-6xl"><p className="mb-8 text-sm text-zinc-400" role="status">Ouverture de ta page…</p><div className="h-9 w-56 rounded-xl bg-zinc-800" /><div className="mt-6 h-48 rounded-2xl bg-zinc-900" /></div>
  </main>;
}
