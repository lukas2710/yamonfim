type Entry = { value: unknown; expires: number };
export function createResourceCache(maxEntries = 16, now = () => Date.now()) {
  const values = new Map<string, Entry>();
  const pending = new Map<string, Promise<unknown>>();
  let generation = 0;
  function get<T>(key: string): T | undefined {
    const entry = values.get(key);
    if (!entry) return undefined;
    if (entry.expires <= now()) { values.delete(key); return undefined; }
    values.delete(key); values.set(key, entry);
    return entry.value as T;
  }
  function set<T>(key: string, value: T, ttl = 60000) {
    values.delete(key); values.set(key, { value, expires: now() + ttl });
    while (values.size > maxEntries) values.delete(values.keys().next().value!);
  }
  function read<T>(key: string, loader: () => PromiseLike<T>, ttl = 60000): Promise<T> {
    const found = get<T>(key);
    if (found !== undefined) return Promise.resolve(found);
    const running = pending.get(key);
    if (running) return running as Promise<T>;
    const version = generation;
    const task = Promise.resolve().then(loader).then(value => { if (version === generation) set(key, value, ttl); return value; })
      .finally(() => { if (pending.get(key) === task) pending.delete(key); });
    pending.set(key, task);
    return task;
  }
  return { get, set, read, clear() { generation++; values.clear(); pending.clear(); } };
}
const resources = createResourceCache();
const mediaResources = createResourceCache(2);
// Browser memory only: no access decisions, account state or persistent storage.
export function readClientResource<T>(key: string, loader: () => PromiseLike<T>, ttl = 60000) {
  return typeof window === 'undefined' ? Promise.resolve().then(loader) : resources.read(key, loader, ttl);
}
export function readClientMedia<T>(key: string, loader: () => PromiseLike<T>) {
  return typeof window === 'undefined' ? Promise.resolve().then(loader) : mediaResources.read(key, loader, 60000);
}
export function clearClientResources() { resources.clear(); mediaResources.clear(); }
