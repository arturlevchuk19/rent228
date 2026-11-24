import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function PeoplePicker({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; const previous = document.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); previous?.focus(); }; }, []);
  return createPortal(<dialog ref={dialog} aria-label={title} onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-lg overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-4 text-gray-200 backdrop:bg-black/70"><header className="mb-4 flex items-center justify-between gap-2"><h3 className="text-lg font-semibold">{title}</h3><button type="button" onClick={onClose} aria-label="Закрыть выбор людей" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-800"><X className="h-5 w-5" /></button></header>{children}</dialog>, document.body);
}
