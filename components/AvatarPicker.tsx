'use client';

import { useState, type KeyboardEvent } from 'react';

type Category = { category: string; avatars: { name: string; url: string }[] };
export default function AvatarPicker({ categories, selected, onSelect }: { categories: Category[]; selected: string; onSelect: (url: string) => void }) {
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-avatar]'));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const columns = getComputedStyle(event.currentTarget).gridTemplateColumns.split(' ').length;
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -columns : columns;
    event.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, index + step))]?.focus();
  }
  const groups = categories.filter(group => !category || group.category === category).map(group => ({ ...group, avatars: group.avatars.filter(item => item.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))) }));
  return <section className="space-y-4" aria-label="Choisir un avatar">
    <div className="flex items-center gap-4"><img src={selected} alt="Avatar sélectionné" className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-blue-500" /><div><h4 className="font-semibold">Choisis ton avatar</h4><p className="text-sm text-zinc-400">Par catégorie ou par nom.</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Catégorie<select value={category} onChange={e => setCategory(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-[#101625] p-3"><option value="">Toutes les catégories</option>{categories.map(group => <option key={group.category}>{group.category}</option>)}</select></label>
      <label className="text-sm">Rechercher<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom de l’avatar" className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-black/30 p-3" /></label>
    </div>
    {groups.map(group => group.avatars.length > 0 && <div key={group.category}><h5 className="mb-3 text-sm font-semibold text-zinc-300">{group.category}</h5><div onKeyDown={navigate} className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
      {group.avatars.map(avatar => <button key={avatar.url} data-avatar type="button" aria-pressed={selected === avatar.url} onClick={() => onSelect(avatar.url)} className={`min-w-0 rounded-xl border-2 p-1.5 text-left transition focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${selected === avatar.url ? 'border-blue-400 bg-blue-500/20' : 'border-transparent bg-white/5 hover:border-white/40'}`}>
        <div className="relative aspect-square overflow-hidden rounded-lg bg-zinc-800"><img src={avatar.url} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} className="relative z-10 h-full w-full object-cover" /><span className="absolute inset-0 flex items-center justify-center text-3xl" aria-hidden="true">{avatar.name[0]}</span>{selected === avatar.url && <span className="absolute right-1 bottom-1 z-20 rounded-full bg-blue-600 px-2 text-white" aria-hidden="true">✓</span>}</div><span className="mt-2 block break-words text-center text-xs sm:text-sm">{avatar.name}</span>
      </button>)}
    </div></div>)}
    {!groups.some(group => group.avatars.length) && <p role="status" className="py-6 text-center text-zinc-400">Aucun avatar trouvé.</p>}
  </section>;
}
