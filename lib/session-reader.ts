type AuthResult = { error: unknown };
function transient(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: string; status?: number; message?: string };
  return value.name === 'AuthRetryableFetchError' || value.status === 0 || (value.status !== undefined && value.status >= 500)
    || /failed to fetch|network|offline|fetch failed/i.test(value.message || '');
}
export function createSessionReader<T extends AuthResult>(load: () => PromiseLike<T>, pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {
  let pending: Promise<T> | null = null, generation = 0;
  async function recover() {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await load();
        if (result.error) throw result.error;
        return result;
      } catch (error) {
        if (attempt >= 2 || !transient(error)) throw error;
        await pause(attempt === 0 ? 250 : 750);
      }
    }
  }
  function read(): Promise<T> {
    if (pending) return pending;
    const version = generation;
    const task = recover().then(result => version === generation ? result : read())
      .finally(() => { if (pending === task) pending = null; });
    pending = task;
    return task;
  }
  return { read, invalidate() { generation++; pending = null; } };
}
