export function parseCreditsTime(input: string): number | null {
  if (!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(input)) return null;
  const parts = input.split(':').map(Number);
  if (parts.slice(1).some(value => value >= 60)) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds >= 0 && seconds < 28800 ? seconds : null;
}
