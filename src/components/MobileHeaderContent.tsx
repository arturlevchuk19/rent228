import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const MobileHeaderContext = createContext<{
  title: HTMLElement | null;
  actions: HTMLElement | null;
}>({ title: null, actions: null });

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia('(max-width: 639px)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const getSnapshot = () => window.matchMedia('(max-width: 639px)').matches;

// Move the actual control, preserving page state, permissions and click handlers.
export function MobileHeaderContent({ children, slot = 'actions' }: {
  children: ReactNode;
  slot?: 'title' | 'actions';
}) {
  const targets = useContext(MobileHeaderContext);
  const mobile = useSyncExternalStore(subscribe, getSnapshot, () => false);
  if (!mobile) return <>{children}</>;
  return targets[slot] ? createPortal(children, targets[slot]) : null;
}
