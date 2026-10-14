/**
 * Helpers for values thrown by `catch` blocks, which are `unknown` by default.
 */

/** Returns the `message` of an Error, or a string representation of anything else. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
