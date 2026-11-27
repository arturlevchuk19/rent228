import { useEffect, useState } from 'react';
import type { BudgetItem } from '../lib/events';
import { getEquipmentItems } from '../lib/equipment';
import { getEquipmentCompositions } from '../lib/equipmentCompositions';
import { getPodiumBracing, getPodiumCoveredArea, getPodiumFootprint, getPodiumModules, getPodiumModuleTab, isPodiumPlatform, PODIUM_TABS } from '../lib/podiumSpecification';
import type { PodiumModule, PodiumTab } from '../lib/podiumSpecification';
import { SpecificationCalculatorDialog, SpecificationCalculatorQuantity } from './SpecificationCalculatorDialog';

interface PodiumSpecificationPanelProps {
  budgetItem: BudgetItem;
  notes: string;
  initialModules: PodiumModule[];
  onClose: () => void;
  onSave: (modules: PodiumModule[]) => void;
}

const formatArea = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const tabClassName = (active: boolean) => `min-h-11 px-3 py-1.5 text-xs rounded-md transition-colors ${
  active ? 'bg-accent-500 text-gray-950' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
}`;

export function PodiumSpecificationPanel({ budgetItem, notes, initialModules, onClose, onSave }: PodiumSpecificationPanelProps) {
  const equipmentId = budgetItem.equipment_id;
  const [selectedModules, setSelectedModules] = useState(initialModules);
  const [options, setOptions] = useState<Omit<PodiumModule, 'quantity'>[]>(() => getPodiumBracing([]));
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [activeTab, setActiveTab] = useState<PodiumTab>('platform');
  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      getEquipmentItems(),
      equipmentId ? getEquipmentCompositions(equipmentId) : Promise.resolve([]),
    ]).then(([catalogResult, templateResult]) => {
      if (!active) return;
      const catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : [];
      const equipment = catalog.filter(item => item.object_type !== 'virtual' && item.id !== equipmentId);
      const templates = templateResult.status === 'fulfilled' ? templateResult.value : [];
      setOptions([
        ...equipment.filter(item => {
          const tab = getPodiumModuleTab(item);
          return tab === 'legs' || (tab === 'platform' && isPodiumPlatform(item));
        }).map(({ id, name, sku, category, note }) => ({ id, name, sku, category, note })),
        ...getPodiumBracing(equipment),
        ...templates.map(template => ({
          id: template.child_id, name: template.child_name, sku: template.child_sku,
          category: template.child_category, note: template.child_note,
        })),
      ]);
      setCatalogState(catalogResult.status === 'fulfilled' ? 'ready' : 'failed');
      if (catalogResult.status === 'rejected') console.error('Error loading podium equipment:', catalogResult.reason);
      if (templateResult.status === 'rejected') console.error('Error loading podium templates:', templateResult.reason);
    });
    return () => { active = false; };
  }, [equipmentId]);

  const modules = getPodiumModules(selectedModules, options);
  const dimensions = getPodiumFootprint(notes, budgetItem.name, budgetItem.equipment?.name);
  const platformModules = modules.filter(module => getPodiumModuleTab(module) === 'platform');
  const totalArea = getPodiumCoveredArea(platformModules);
  const requiredArea = dimensions?.area ?? 0;
  const progress = requiredArea > 0 ? totalArea / requiredArea * 100 : 0;

  const visibleModules = modules.filter(module => getPodiumModuleTab(module) === activeTab);

  const changeQuantity = (module: PodiumModule, quantity: number) => {
    const changed = { ...module, quantity: Math.max(0, quantity) };
    setSelectedModules(current => current.some(item => item.id === module.id)
      ? current.map(item => item.id === module.id ? changed : item)
      : [...current, changed]);
  };

  const save = () => {
    const selected = selectedModules.filter(module => module.quantity > 0);
    const initial = initialModules.filter(module => module.quantity > 0);
    if (selected.length === initial.length && selected.every(module =>
      initial.some(item => item.id === module.id && item.quantity === module.quantity)
    )) {
      onClose();
      return;
    }
    onSave(selected);
  };

  return (
    <SpecificationCalculatorDialog title="Спецификация подиума" onClose={onClose} onSave={save}>
      <div className="rounded-lg bg-gray-800/50 p-4">
        <h4 className="text-sm font-medium text-white">{budgetItem.equipment?.name || budgetItem.name || 'Подиум'}</h4>
        {dimensions && (
          <p className="mt-1 text-xs text-gray-400">{formatArea.format(dimensions.width)} × {formatArea.format(dimensions.depth)} м</p>
        )}
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-sm">
          <span className="text-gray-300">Площадь площадок</span>
          <span className="font-medium tabular-nums text-white">
            {formatArea.format(totalArea)}{dimensions && ` / ${formatArea.format(requiredArea)}`} м²
            {dimensions && <span className="ml-2 text-xs text-gray-400">{formatArea.format(progress)}%</span>}
          </span>
        </div>
        {dimensions && (
          <div role="progressbar" aria-label="Покрытие площади сцены" aria-valuemin={0} aria-valuemax={requiredArea}
            aria-valuenow={Math.min(totalArea, requiredArea)} aria-valuetext={`${formatArea.format(totalArea)} из ${formatArea.format(requiredArea)} м²`}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-700">
            <div className={`h-full rounded-full motion-safe:transition-[width] ${progress >= 100 ? 'bg-green-500' : 'bg-accent-500'}`}
              style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        )}
      </div>

      <div role="group" aria-label="Элементы подиума" className="flex flex-wrap gap-2">
        {PODIUM_TABS.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id} className={tabClassName(activeTab === tab.id)}>
            {tab.label} ({modules.filter(module => module.quantity > 0 && getPodiumModuleTab(module) === tab.id).length})
          </button>
        ))}
      </div>

      {catalogState === 'loading' && <p role="status" className="text-sm text-gray-400">Загружаем справочник…</p>}
      {catalogState === 'failed' && <p role="status" className="text-sm text-gray-400">Справочник недоступен.</p>}

      {visibleModules.map(module => (
        <div key={module.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-gray-700 bg-gray-800 p-3 sm:p-4">
          <div className="min-w-0 flex-1">
            <h5 className="break-words text-sm font-medium text-white">{module.name}</h5>
            {module.sku && <p className="break-all text-xs text-gray-400">{module.sku}</p>}
            {module.note && <p className="mt-1 break-words text-xs text-gray-400">{module.note}</p>}
          </div>
          <SpecificationCalculatorQuantity name={module.name} quantity={module.quantity} onChange={quantity => changeQuantity(module, quantity)} />
        </div>
      ))}

      {catalogState === 'ready' && visibleModules.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-400">{PODIUM_TABS.find(tab => tab.id === activeTab)?.empty}</p>
      )}
    </SpecificationCalculatorDialog>
  );
}
