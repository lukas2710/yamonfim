export function reconcileMemberDrafts<T extends string | number>(drafts: Record<string, T>, previousServer: Record<string, T>, nextServer: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(nextServer).map(([id, value]) => [id, drafts[id] === undefined || drafts[id] === previousServer[id] ? value : drafts[id]]));
}
interface VipState { id: string; email?: string; is_vip: boolean | string }
const active = (value: boolean | string) => value === true || value === 'true';
export function newlyActivatedMembers(previous: VipState[], next: VipState[], initialized: boolean) {
  if (!initialized) return [];
  const old = new Map(previous.map(member => [member.id, member]));
  return next.filter(member => active(member.is_vip) && !active(old.get(member.id)?.is_vip ?? false));
}
