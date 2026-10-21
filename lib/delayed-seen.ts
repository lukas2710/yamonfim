export const SEEN_DELAY_MS = 5000;
export function scheduleSeen(callback: () => void, schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> = setTimeout, cancel: (timer: ReturnType<typeof setTimeout>) => void = clearTimeout) {
  let active = true;
  const timer = schedule(() => { if (active) { active = false; callback(); } }, SEEN_DELAY_MS);
  return () => { active = false; cancel(timer); };
}
