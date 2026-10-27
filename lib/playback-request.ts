// A short, in-memory handoff for the next episode. Never stored on disk and
// scoped to the current access token; quota/history remain in the launch flow.
type Reply = { ok: boolean; status: number; data: Record<string, any> };
const prepared = new Map<string, { expires: number; reply: Promise<Reply> }>();
export function invalidatePlayback(url: string, token: string) { prepared.delete(`${token}:${url}`); }
export function playbackRequest(url: string, token: string, excluded: string[] = [], selected = ''): Promise<Reply> {
  const reusable = !excluded.length && !selected;
  const key = `${token}:${url}`;
  const cached = prepared.get(key);
  if (reusable && cached && cached.expires > Date.now()) return cached.reply;
  const reply = fetch('/api/playback', {
    method: 'POST', signal: AbortSignal.timeout(55000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, excluded, selected }),
  }).then(async response => ({ ok: response.ok, status: response.status, data: await response.json() }));
  if (reusable) {
    if (prepared.size >= 4) prepared.delete(prepared.keys().next().value!);
    const entry = { expires: Date.now() + 45000, reply };
    prepared.set(key, entry);
    void reply.then(result => {
      if (prepared.get(key) !== entry) return;
      if (!result.ok) prepared.delete(key); else entry.expires = Date.now() + 45000;
    }, () => { if (prepared.get(key) === entry) prepared.delete(key); });
  }
  return reply;
}
