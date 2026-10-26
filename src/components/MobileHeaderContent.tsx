import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const MobileHeaderContext = createContext<{
  active?: boolean;
  title: HTMLElement | null;
  actions: HTMLElement | null;
}>({ title: null, actions: null });

// Move the actual control, preserving page state, permissions and click handlers.
export function MobileHeaderContent({ children, slot = 'actions' }: {
  children: ReactNode;
  slot?: 'title' | 'actions';
}) {
  const targets = useContext(MobileHeaderContext);
  return targets.active !== false && targets[slot] ? createPortal(children, targets[slot]) : null;
}
