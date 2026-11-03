import { getErrorMessage } from './errors';

export const isBudgetNetworkError = (error: unknown) => /load failed|failed to fetch|networkerror|network request failed|network connection was lost|fetch failed/i.test(getErrorMessage(error));

/** Retry only idempotent field updates, never creation or deletion. */
export async function retryBudgetUpdate<T>(write: () => Promise<T>, wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))): Promise<T> {
  try { return await write(); }
  catch (error) {
    if (!isBudgetNetworkError(error)) throw error;
    await wait(400);
    return write();
  }
}
