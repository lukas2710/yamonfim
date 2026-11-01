export default function WatchStatusBadge({ completed, inProgress, className = '', compact = false }: { completed: boolean; inProgress: boolean; className?: string; compact?: boolean }) {
  if (!completed && !inProgress) return null;
  return <span aria-label={completed ? 'Titre vu entièrement' : 'Lecture en cours'} className={`absolute right-1 top-1 z-10 max-w-[calc(100%-8px)] truncate rounded-md px-1.5 py-1 text-[9px] font-bold leading-none text-white shadow-lg ${completed ? 'bg-emerald-600' : 'bg-blue-700'} ${className}`}>
    {completed ? '✓ Vu' : compact ? 'En cours' : 'Lecture en cours'}
  </span>;
}
