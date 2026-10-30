import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

export function useCatalogLongPress(onHold: (key: string) => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const start = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const consumed = useRef(false);
  const callback = useRef(onHold);
  callback.current = onHold;
  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  };
  useEffect(() => {
    window.addEventListener('scroll', cancel, true);
    window.addEventListener('blur', cancel);
    return () => {
      cancel();
      window.removeEventListener('scroll', cancel, true);
      window.removeEventListener('blur', cancel);
    };
  }, []);
  return (key: string) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      cancel();
      consumed.current = false;
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      timer.current = setTimeout(() => {
        consumed.current = true;
        start.current = null;
        callback.current(key);
      }, 500);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const origin = start.current;
      if (origin && (event.pointerId !== origin.pointerId || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10)) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (consumed.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    onContextMenuCapture: (event: MouseEvent<HTMLElement>) => {
      if (consumed.current || start.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  });
}
