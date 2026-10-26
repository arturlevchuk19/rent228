/**
 * Helpers for values thrown by `catch` blocks, which are `unknown` by default.
 */

/** Returns the `message` of an Error, or a string representation of anything else. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return String(error);
}
