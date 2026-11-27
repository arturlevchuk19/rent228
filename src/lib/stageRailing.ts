import type { EquipmentItem } from './equipment';
import type { PodiumModule } from './podiumSpecification';

export const STAGE_RAILING_CALCULATOR_TITLE = 'Спецификация ограждения';

export const STAGE_RAILING_PARTS = [
  { key: 'twoMetre', name: 'Ограждение сцены 2 м', sku: 'SCN_PDM_FENC_2', aliases: ['ограждение сценического подиума 2м'] },
  { key: 'oneMetre', name: 'Ограждение сцены 1 м', sku: 'SCN_PDM_FENC_1', aliases: ['ограждение сценического подиума 1м'] },
  { key: 'anchors', name: 'Закладная для ограждения сцены', sku: 'SCN_FIX_OTH_FENC', aliases: ['закладная для ограждение сцены', 'крепления для ограждения'] },
  { key: 'legs', name: 'Нога 20 см', sku: 'SCN_PDM_LEG_20', aliases: ['нога 20'] },
] as const;

type Part = (typeof STAGE_RAILING_PARTS)[number]['key'];
export type StageRailingCounts = Record<Part, number>;
type PartIdentity = Pick<PodiumModule, 'name' | 'sku'>;

const normalizeName = (name: string) => name.toLowerCase().replace(/\s+/g, '');

function stageRailingPart({ name, sku }: PartIdentity) {
  const normalizedName = normalizeName(name);
  return STAGE_RAILING_PARTS.find(part => part.sku === (sku || '').trim().toUpperCase()
    || normalizeName(part.name) === normalizedName
    || part.aliases.some(alias => normalizeName(alias) === normalizedName))?.key;
}

export function isStageRailing(name = '', sku = '') {
  return /ограждени[ея]\s+(?:для\s+)?(?:сцены|(?:сценического\s+)?подиума)(?=\s|[.,:(]|$)/i.test(name)
    && !stageRailingPart({ name, sku });
}

export function getStageRailingOptions(catalog: EquipmentItem[]) {
  return STAGE_RAILING_PARTS.map(part => {
    const equipment = catalog.find(item => item.object_type !== 'virtual' && normalizeName(item.name) === normalizeName(part.name))
      ?? catalog.find(item => item.object_type !== 'virtual' && stageRailingPart(item) === part.key);
    return {
      key: part.key,
      id: equipment?.id ?? `railing-${part.key}`,
      name: part.name,
      sku: equipment?.sku || part.sku,
      category: equipment?.category || 'Сцена',
    };
  });
}

export function getStageRailingCounts(modules: PodiumModule[]) {
  return modules.reduce<StageRailingCounts>((counts, module) => {
    const key = stageRailingPart(module);
    if (key) counts[key] += module.quantity;
    return counts;
  }, { twoMetre: 0, oneMetre: 0, anchors: 0, legs: 0 });
}

export function suggestStageRailingHardware({ twoMetre, oneMetre }: Pick<StageRailingCounts, 'twoMetre' | 'oneMetre'>) {
  const sections = twoMetre + oneMetre;
  return { anchors: sections * 2, legs: sections };
}

export function getStageRailingComposition(
  counts: StageRailingCounts, initialModules: PodiumModule[], options: ReturnType<typeof getStageRailingOptions>,
) {
  const parts = options.flatMap(({ key, ...option }) => {
    const existing = initialModules.filter(item => stageRailingPart(item) === key);
    const quantity = counts[key];
    if (existing.reduce((sum, item) => sum + item.quantity, 0) === quantity) return existing;
    return quantity > 0 ? [{ ...(existing[0] || option), quantity }] : [];
  });
  return [...parts, ...initialModules.filter(item => !stageRailingPart(item))];
}
