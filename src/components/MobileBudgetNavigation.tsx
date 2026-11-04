import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, Calculator, Package, Plus, Receipt, Settings, Users, X } from 'lucide-react';

export type MobileBudgetTab = 'equipment' | 'personnel' | 'estimate' | 'total';

export function MobileBudgetNavigation({ name, tab, onTabChange, count, onBack, onSettings, onCategory, onLocation, onService, onTemplate, categoryMenu }: {
  name: string; tab: MobileBudgetTab; onTabChange: (tab: MobileBudgetTab) => void;
  count: number; onBack: () => void; onSettings: () => void;
  onCategory: () => void; onLocation: () => void; onService: () => void; onTemplate: () => void;
  categoryMenu: ReactNode;
}) {
  return <div className="shrink-0 bg-gray-950 md:hidden">
    <header className="flex items-center gap-2 border-b border-gray-800 px-3 py-3">
      <button type="button" onClick={onBack} aria-label="Назад из сметы" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-300 active:bg-gray-800"><ArrowLeft className="h-5 w-5" /></button>
      <h1 className="min-w-0 flex-1 break-words text-lg font-semibold text-white">Смета: {name}</h1>
      <button type="button" onClick={onSettings} aria-label="Настройки сметы" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-300 active:bg-gray-800"><Settings className="h-5 w-5" /></button>
    </header>
    <nav aria-label="Разделы сметы" className="mx-3 mt-3 mb-3 flex gap-1 rounded-2xl bg-gray-800 p-1">
      {([
        { id: 'equipment', label: 'Оборудование', icon: Package },
        { id: 'personnel', label: 'Персонал и доставка', icon: Users },
        { id: 'estimate', label: 'Смета', icon: Receipt },
        { id: 'total', label: 'Итого', icon: Calculator },
      ] as const).map(({ id, label, icon: Icon }) => <button
        key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => onTabChange(id)}
        className={`relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-xs font-semibold transition-colors ${tab === id ? 'bg-amber-400/10 text-amber-200 ring-1 ring-inset ring-amber-200' : 'bg-gray-950/70 text-gray-400'}`}
      >
        <span className="relative"><Icon className="h-5 w-5" />{id === 'estimate' && count > 0 && <span className="absolute -right-5 -top-1 min-w-4 rounded-full bg-amber-500 px-1 text-[10px] leading-4 text-gray-950">{count}</span>}</span>
        <span className="max-w-full break-words">{label}</span>
      </button>)}
    </nav>
    {tab === 'estimate' && (
      <div className="category-dropdown-container relative px-3">
      <div aria-label="Добавление в смету" className="flex items-center gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden whitespace-nowrap py-2 text-sm font-semibold text-gray-200">
        <Plus aria-hidden="true" className="h-4 w-4 shrink-0 text-white" />
        <button type="button" onClick={onCategory} className="min-h-11 active:text-cyan-400">Категория</button>
        <button type="button" onClick={onLocation} className="min-h-11 active:text-cyan-400">Зона</button>
        <button type="button" onClick={onService} className="min-h-11 active:text-cyan-400">Доп. услуга</button>
        <button type="button" onClick={onTemplate} className="min-h-11 active:text-cyan-400">Шаблон</button>
      </div>
      {categoryMenu}
    </div>
    )}
  </div>;
}

export function MobileBudgetSettings({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);
  return <dialog ref={ref} aria-labelledby="mobile-budget-settings-title" onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-0 text-gray-200 shadow-2xl backdrop:bg-black/70">
    <div className="p-4" onClick={event => event.stopPropagation()}>
      <header className="mb-4 flex items-center justify-between gap-3"><h2 id="mobile-budget-settings-title" className="font-semibold text-white">Настройки сметы</h2><button type="button" aria-label="Закрыть настройки" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-800"><X className="h-5 w-5" /></button></header>
      <div className="space-y-5">{children}</div>
      <button type="button" onClick={onClose} className="mt-5 min-h-11 w-full rounded-xl bg-cyan-600 font-semibold text-white">Готово</button>
    </div>
  </dialog>;
}
