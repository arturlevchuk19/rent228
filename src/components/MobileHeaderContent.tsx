import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const MobileHeaderContext = createContext<{
  active?: boolean;
  title: HTMLElement | null;
  actions: HTMLElement | null;
  afterTitle?: HTMLElement | null;
}>({ title: null, actions: null });

// Move the actual control, preserving page state, permissions and click handlers.
export function MobileHeaderContent({ children, slot = 'actions', page = false }: {
  children: ReactNode;
  slot?: 'title' | 'actions' | 'afterTitle';
  page?: boolean;
}) {
  const targets = useContext(MobileHeaderContext);
  return (page || targets.active !== false) && targets[slot] ? createPortal(children, targets[slot]) : null;
}
