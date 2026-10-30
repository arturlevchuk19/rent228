export type AutosaveStatus = 'saved' | 'saving' | 'error';

/** Serialize writes and coalesce typing without allowing old responses to win. */
export function createBudgetAutosave<T extends object>(write: (patch: Partial<T>) => Promise<unknown>, report: (status: AutosaveStatus, error?: unknown, pending?: Partial<T>) => void, delay = 300) {
  let saved: T | null = null;
  let desired: T | null = null;
  let running: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const diff = () => Object.fromEntries(Object.entries(desired || {}).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(saved?.[key as keyof T]))) as Partial<T>;
  const notify = (status: AutosaveStatus, error?: unknown) => report(status, error, diff());
  const flush = (): Promise<void> => {
    clearTimeout(timer);
    if (running) return running.then(flush);
    if (!saved || !desired || !Object.keys(diff()).length) return Promise.resolve();
    running = (async () => {
      try {
        while (Object.keys(diff()).length) {
          const patch = diff();
          notify('saving');
          await write(patch);
          saved = { ...saved!, ...patch };
        }
        notify('saved');
      } catch (error) { notify('error', error); throw error; }
      finally { running = null; }
    })();
    return running;
  };
  return {
    initialize: (value: T) => { if (!saved) { saved = { ...value }; desired = { ...value }; } },
    stage: (value: T) => {
      if (!saved) return;
      desired = { ...value };
      clearTimeout(timer);
      if (!Object.keys(diff()).length && !running) { notify('saved'); return; }
      notify('saving');
      timer = setTimeout(() => { void flush().catch(() => {}); }, delay);
    },
    flush,
  };
}
