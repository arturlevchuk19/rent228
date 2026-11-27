import type { EquipmentItem } from './equipment';

export interface PodiumModule {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  note?: string;
}

export const PODIUM_TABS = [
  { id: 'platform', label: 'Площадка', empty: 'Элементы площадки не заданы' },
  { id: 'legs', label: 'Ноги', empty: 'Ноги не заданы' },
  { id: 'bracing', label: 'Обвязка', empty: 'Элементы обвязки не заданы' },
] as const;

export type PodiumTab = (typeof PODIUM_TABS)[number]['id'];

const BRACING = [
  { id: 'silver-pipe-2-5', name: 'Труба серебристая 2,5 м', sku: 'SCN_PIPE_(S)_2,5', length: '2.5' },
  { id: 'silver-pipe-3', name: 'Труба серебристая 3 м', sku: 'SCN_PIPE_(S)_3', length: '3' },
  { id: 'double-clamp-china', name: 'Двойной хомут China', sku: '', brand: 'china' },
  { id: 'double-clamp-pkc', name: 'Двойной хомут PKC', sku: '', brand: 'pkc' },
] as const;

type ModuleIdentity = Pick<PodiumModule, 'name' | 'sku'>;
type PodiumOption = Omit<PodiumModule, 'quantity'>;

const normalizeSku = (sku: string) => (sku || '').trim().toUpperCase().replace(',', '.');

function matchBracing({ name, sku, attribute = '', subtype = '' }: ModuleIdentity & { attribute?: string; subtype?: string }) {
  const normalizedSku = normalizeSku(sku);
  const text = `${name} ${subtype} ${attribute}`.toLowerCase().replace(/,/g, '.');

  return BRACING.find(item => {
    if ('length' in item) {
      return normalizedSku === item.sku.replace(',', '.') || (
        /труб.*серебр/.test(text) && text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:м\s|\s|$)/)?.[1] === item.length
      );
    }
    const doubleClamp = /^SCN_FIX_CLAMP_X2/i.test(sku) || (
      /хомут|кл[еэ]мп|clamp/.test(text) && /двойн|double|clamp\s*x2/.test(text)
    );
    return doubleClamp && `${text} ${sku}`.toLowerCase().includes(item.brand);
  });
}

export function getPodiumModules(selected: PodiumModule[], options: PodiumOption[]): PodiumModule[] {
  const matches = (a: PodiumOption, b: PodiumOption) => {
    if (a.id === b.id || (a.name === b.name && normalizeSku(a.sku) === normalizeSku(b.sku))) return true;
    const brace = matchBracing(a);
    return !!brace && matchBracing(b)?.id === brace.id;
  };
  const matchedIds = new Set<string>();
  const rows: PodiumModule[] = [];
  for (const option of options) {
    if (rows.some(item => matches(item, option))) continue;
    const saved = selected.find(item => matches(item, option));
    if (saved) matchedIds.add(saved.id);
    rows.push(saved ? { ...option, ...saved } : { ...option, quantity: 0 });
  }
  return [...selected.filter(item => !matchedIds.has(item.id)), ...rows];
}

export function getPodiumModuleTab(item: ModuleIdentity): PodiumTab {
  if (matchBracing(item) || /^SCN_FIX_CLAMP_X2/i.test(item.sku)) return 'bracing';
  if (/(?:^|[^а-яё])(?:ног[аи]|ножк[аи])(?:[^а-яё]|$)/i.test(item.name) || /^SCN_PDM_LEG_/i.test(item.sku)) return 'legs';
  return 'platform';
}

export function isPodiumPlatform({ name, sku }: ModuleIdentity) {
  return /подиум|площадк|настил|панел/i.test(name) || /^SCN_PDM_(?:IN|OUT)_/i.test(sku);
}

export function getPodiumBracing(catalog: EquipmentItem[]) {
  return BRACING.map(option => {
    const equipment = catalog.find(item => item.object_type !== 'virtual' && matchBracing(item)?.id === option.id);
    return {
      id: equipment?.id ?? option.id,
      name: option.name,
      sku: equipment?.sku || option.sku,
      category: equipment?.category || 'Конструкции',
      note: equipment?.note || '',
    };
  });
}

export function getPodiumFootprint(...texts: (string | undefined)[]) {
  for (const text of texts) {
    const match = text?.match(/(\d+(?:[.,]\d+)?)\s*[xх×]\s*(\d+(?:[.,]\d+)?)/i);
    if (!match) continue;
    const width = Number(match[1].replace(',', '.'));
    const depth = Number(match[2].replace(',', '.'));
    const area = width * depth;
    if (Number.isFinite(area) && area > 0) return { width, depth, area };
  }
  return null;
}

export function getPodiumCoveredArea(platforms: PodiumModule[]) {
  return platforms.reduce((area, item) => {
    const footprint = isPodiumPlatform(item) ? getPodiumFootprint(item.name, item.sku) : null;
    return area + (footprint?.area ?? 0) * item.quantity;
  }, 0);
}
