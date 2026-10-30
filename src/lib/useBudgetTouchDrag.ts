import { useEffect, useRef, type RefObject } from 'react';
import type { BudgetDragTarget } from '../components/CategoryBlock';

type Source = { type: 'item' | 'category'; id: string };
type Options = {
  enabled: boolean;
  onStart: (source: Source) => void;
  onDrop: (itemId: string | null, group: BudgetDragTarget | null) => Promise<void>;
  onCancel: () => void;
  onError: (error: unknown) => void;
};

/** A dedicated handle keeps ordinary touch scrolling and editing available. */
export function useBudgetTouchDrag(list: RefObject<HTMLDivElement>, options: Options) {
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    const root = list.current;
    if (!root || !options.enabled) return;
    let session: { pointerId: number; source: Source; handle: HTMLElement; x: number; y: number; startX: number; startY: number; active: boolean } | null = null;
    let ghost: HTMLDivElement | null = null;
    let marked: HTMLElement | null = null;
    let frame = 0;
    const hit = () => session ? document.elementFromPoint(session.x, session.y) : null;
    const clear = () => {
      cancelAnimationFrame(frame);
      marked?.classList.remove('budget-touch-target');
      marked = null;
      ghost?.remove(); ghost = null;
      const current = session; session = null;
      if (current?.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
    };
    const tick = () => {
      if (!session?.active) return;
      const bounds = root.getBoundingClientRect();
      const edge = 64;
      const speed = session.y < bounds.top + edge ? -Math.min(14, (bounds.top + edge - session.y) / 4)
        : session.y > bounds.bottom - edge ? Math.min(14, (session.y - bounds.bottom + edge) / 4) : 0;
      root.scrollTop += speed;
      const el = hit();
      const target = el && root.contains(el) ? el.closest<HTMLElement>(session.source.type === 'item' ? '[data-budget-item-id], [data-budget-drop-group]' : '[data-budget-drop-group]') : null;
      if (marked !== target) { marked?.classList.remove('budget-touch-target'); marked = target; marked?.classList.add('budget-touch-target'); }
      if (ghost) { ghost.style.left = `${session.x + 12}px`; ghost.style.top = `${session.y + 12}px`; }
      frame = requestAnimationFrame(tick);
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || !event.isPrimary || session) return;
      const handle = (event.target as Element).closest<HTMLElement>('[data-budget-drag-type]');
      if (!handle || !root.contains(handle)) return;
      const type = handle.dataset.budgetDragType;
      const id = handle.dataset.budgetDragId;
      if (!id || (type !== 'item' && type !== 'category')) return;
      session = { pointerId: event.pointerId, source: { type, id }, handle, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, active: false };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    };
    const move = (event: PointerEvent) => {
      if (!session || session.pointerId !== event.pointerId) return;
      event.preventDefault();
      session.x = event.clientX; session.y = event.clientY;
      if (!session.active && Math.hypot(session.x - session.startX, session.y - session.startY) >= 6) {
        session.active = true;
        ghost = document.createElement('div');
        ghost.className = 'budget-touch-ghost';
        ghost.textContent = session.handle.dataset.budgetDragLabel || 'Перемещение';
        document.body.appendChild(ghost);
        latest.current.onStart(session.source);
        frame = requestAnimationFrame(tick);
      }
    };
    const finish = (event: PointerEvent) => {
      if (!session || session.pointerId !== event.pointerId) return;
      const active = session.active;
      session.x = event.clientX; session.y = event.clientY;
      const el = hit();
      const inside = el && root.contains(el);
      const itemId = inside ? el.closest<HTMLElement>('[data-budget-item-id]')?.dataset.budgetItemId || null : null;
      const raw = inside ? el.closest<HTMLElement>('[data-budget-drop-group]')?.dataset.budgetDropGroup : null;
      let group: BudgetDragTarget | null = null;
      try { if (raw) group = JSON.parse(raw) as BudgetDragTarget; } catch { /* Invalid targets cancel the move. */ }
      clear();
      if (!active) return;
      if (event.type === 'pointerup' && inside && (itemId || group)) {
        void latest.current.onDrop(itemId, group).catch(latest.current.onError).finally(() => latest.current.onCancel());
      } else latest.current.onCancel();
    };
    const cancel = () => { const active = session?.active; clear(); if (active) latest.current.onCancel(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    root.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', key);
    return () => {
      clear();
      root.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', key);
    };
  }, [list, options.enabled]);
}
