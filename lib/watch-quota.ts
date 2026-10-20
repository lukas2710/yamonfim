export const FREE_WATCH_LIMIT = 5;
export interface WatchAccount { vip: boolean; count: number }
export type WatchAccess = { allowed: boolean; vip: boolean; remaining: number | null };

// A conditional database update reserves one viewing, even across concurrent tabs.
export async function reserveViewing(read: () => Promise<WatchAccount>, increment: (expected: number) => Promise<boolean>): Promise<WatchAccess> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const account = await read();
    if (account.vip) return { allowed: true, vip: true, remaining: null };
    if (!Number.isInteger(account.count) || account.count < 0) throw new Error('Quota invalide');
    if (account.count >= FREE_WATCH_LIMIT) return { allowed: false, vip: false, remaining: 0 };
    if (await increment(account.count)) return { allowed: true, vip: false, remaining: FREE_WATCH_LIMIT - account.count - 1 };
  }
  throw new Error('Le quota est en cours de modification. Réessaie.');
}
