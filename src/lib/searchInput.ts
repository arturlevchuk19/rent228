import type { KeyboardEvent } from 'react';

// Search results update as the user types; Enter finishes input without submitting a surrounding form.
function finishSearchInput(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return;

  event.preventDefault();
  event.currentTarget.blur();
}

export const searchInputProps = {
  enterKeyHint: 'search',
  onKeyDown: finishSearchInput,
} as const;
