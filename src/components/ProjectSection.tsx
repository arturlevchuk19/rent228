import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Pencil, Check } from 'lucide-react';

export function ProjectSection({ title, subtitle, count, children, editor, editable, defaultOpen = false, actions }: {
  title: string; subtitle?: string; count?: number; children: ReactNode; editor?: ReactNode;
  editable?: boolean; defaultOpen?: boolean; actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const contentId = useId();
  return <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/70">
    <header className={`flex items-center gap-2 px-4 py-4 sm:px-5 ${open ? 'border-b border-gray-800' : ''}`}>
      <button type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-400">{title}{count !== undefined && <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs normal-case">{count}</span>}</span>
        {subtitle && <span className="mt-1 block text-xs text-gray-500">{subtitle}</span>}
      </button>
      {actions}
      {editable && editor && <button type="button" aria-label={editing ? `Завершить ввод: ${title}` : `Изменить: ${title}`} onClick={() => { setEditing(!editing); setOpen(true); }} className={`shrink-0 rounded-lg p-2 ${editing ? 'bg-cyan-900/30 text-cyan-400' : 'text-gray-500 hover:bg-gray-800 hover:text-cyan-400'}`}>{editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}</button>}
      <button type="button" aria-label={open ? `Свернуть: ${title}` : `Раскрыть: ${title}`} aria-expanded={open} aria-controls={contentId} onClick={() => setOpen(!open)} className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-white"><ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} /></button>
    </header>
    {open && <div id={contentId} className="p-4 sm:p-5">{editing && editable ? editor : children}</div>}
  </section>;
}
