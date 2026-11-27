import { useEffect, useId, useState } from 'react';
import { getEquipmentItems } from '../lib/equipment';
import type { PodiumModule } from '../lib/podiumSpecification';
import { getStageRailingComposition, getStageRailingCounts, getStageRailingOptions, STAGE_RAILING_CALCULATOR_TITLE, suggestStageRailingHardware } from '../lib/stageRailing';
import { SpecificationCalculatorDialog, SpecificationCalculatorQuantity } from './SpecificationCalculatorDialog';

const groups = [{ label: 'Секции', hardware: false }, { label: 'Комплектующие', hardware: true }];

export function StageRailingSpecificationPanel({ initialModules, onClose, onSave }: {
  initialModules: PodiumModule[]; onClose: () => void; onSave: (modules: PodiumModule[]) => void;
}) {
  const [initial] = useState(() => getStageRailingCounts(initialModules));
  const initialSuggestion = suggestStageRailingHardware(initial);
  const [sections, setSections] = useState({ twoMetre: initial.twoMetre, oneMetre: initial.oneMetre });
  const [manual, setManual] = useState(() => ({
    anchors: initial.anchors === initialSuggestion.anchors ? null : initial.anchors,
    legs: initial.legs === initialSuggestion.legs ? null : initial.legs,
  }));
  const [options, setOptions] = useState(() => getStageRailingOptions([]));
  const hintId = useId();

  useEffect(() => {
    let active = true;
    void getEquipmentItems().then(catalog => {
      if (active) setOptions(getStageRailingOptions(catalog));
    }).catch(error => console.error('Error loading stage railing equipment:', error));
    return () => { active = false; };
  }, []);

  const suggested = suggestStageRailingHardware(sections);
  const counts = { ...sections, anchors: manual.anchors ?? suggested.anchors, legs: manual.legs ?? suggested.legs };

  const save = () => {
    if (options.every(({ key }) => counts[key] === initial[key])) onClose();
    else onSave(getStageRailingComposition(counts, initialModules, options));
  };

  return (
    <SpecificationCalculatorDialog title={STAGE_RAILING_CALCULATOR_TITLE} onClose={onClose} onSave={save}>
      {groups.map(group => (
        <section key={group.label} aria-label={group.label} className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-200">{group.label}</h4>
          {options.filter(({ key }) => (key === 'anchors' || key === 'legs') === group.hardware).map(({ key, name }) => {
            const hardware = key === 'anchors' || key === 'legs';
            const hint = hardware ? `${hintId}-${key}` : undefined;
            return (
              <div key={key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-gray-700 bg-gray-800 p-3 sm:p-4">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-white">{name}</p>
                  {hardware && (
                    <p id={hint} className="mt-1 text-xs text-gray-400">
                      {manual[key] === null ? (key === 'anchors' ? 'Авто · 2 на секцию' : 'Авто · 1 на секцию') : `Вручную · по расчёту ${suggested[key]} шт.`}
                    </p>
                  )}
                  {hardware && manual[key] !== null && (
                    <button type="button" onClick={() => setManual(current => ({ ...current, [key]: null }))}
                      aria-label={`Вернуть расчёт: ${name}`} className="min-h-8 text-xs text-accent-400 underline underline-offset-2 hover:text-accent-300">
                      Вернуть расчёт
                    </button>
                  )}
                </div>
                <SpecificationCalculatorQuantity name={name} quantity={counts[key]} descriptionId={hint} onChange={quantity => {
                  if (hardware) setManual(current => ({ ...current, [key]: quantity }));
                  else setSections(current => ({ ...current, [key]: quantity }));
                }} />
              </div>
            );
          })}
        </section>
      ))}
    </SpecificationCalculatorDialog>
  );
}
