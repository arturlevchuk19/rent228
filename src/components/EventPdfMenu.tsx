import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';

export function EventPdfMenu({ disabled, generating, onSpecification }: {
  disabled: boolean;
  generating: boolean;
  onSpecification: () => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstOption = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    firstOption.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  return <div ref={container} className="relative" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    }
  }}>
    <button ref={trigger} type="button" disabled={disabled} aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(value => !value)}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 disabled:opacity-40">
      <FileText aria-hidden="true" className="h-4 w-4" />{generating ? 'Создание PDF...' : 'PDF'}
      <ChevronDown aria-hidden="true" className="h-4 w-4" />
    </button>
    {open && <div id={panelId} className="absolute right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-700 bg-gray-900 p-1">
      <button ref={firstOption} type="button" onClick={() => {
        setOpen(false);
        trigger.current?.focus();
        onSpecification();
      }} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500">
        <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />PDF — Спецификация
      </button>
    </div>}
  </div>;
}
