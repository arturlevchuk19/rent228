import React, { useState } from 'react';
import { X, Calculator } from 'lucide-react';
import { EquipmentItem } from '../../lib/equipment';

export interface DialogResult {
  quantity: number;
  customName: string;
  customPrice: number;
}

interface PodiumStairDialogProps {
  equipment: EquipmentItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: DialogResult) => void;
}

export function PodiumStairDialog({ equipment, isOpen, onClose, onConfirm }: PodiumStairDialogProps) {
  const [stairHeight, setStairHeight] = useState('');
  const [stepsCount, setStepsCount] = useState('');
  const [stepWidth, setStepWidth] = useState('');
  const [stepDepth, setStepDepth] = useState('');
  const [stepHeight, setStepHeight] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setStairHeight('');
    setStepsCount('');
    setStepWidth('');
    setStepDepth('');
    setStepHeight('');
    onClose();
  };

  const parse = (value: string) => parseFloat(value.replace(',', '.'));

  const handleConfirm = () => {
    if (!stairHeight || !stepsCount || !stepWidth || !stepDepth || !stepHeight) return;

    const stairHeightNum = parse(stairHeight);
    const stepsCountNum = parse(stepsCount);
    const stepWidthNum = parse(stepWidth);
    const stepDepthNum = parse(stepDepth);
    const stepHeightNum = parse(stepHeight);

    if ([stairHeightNum, stepsCountNum, stepWidthNum, stepDepthNum, stepHeightNum].some((v) => Number.isNaN(v))) {
      return;
    }

    const totalPrice = stepWidthNum * stepDepthNum * stepsCountNum * equipment.rental_price;
    const customName = `размер ступени:${stepWidthNum}x${stepDepthNum}x${stepHeightNum}; общая высота: ${stairHeightNum} (${stepsCountNum})`;

    onConfirm({
      quantity: 1,
      customName,
      customPrice: totalPrice
    });

    handleClose();
  };

  const isValid = [stairHeight, stepsCount, stepWidth, stepDepth, stepHeight].every((v) => v !== '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[70] p-0 sm:p-4" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="bg-gray-900 border border-gray-800 rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-[520px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-white">Параметры лестницы</h3>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto overscroll-contain flex-1">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Оборудование</p>
            <p className="text-sm font-medium text-white">{equipment.name}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Высота лестницы (м)', value: stairHeight, setValue: setStairHeight, placeholder: '1.2', mode: 'decimal' as const },
              { label: 'Кол-во ступеней (шт)', value: stepsCount, setValue: setStepsCount, placeholder: '5', mode: 'numeric' as const },
              { label: 'Ширина ступени (м)', value: stepWidth, setValue: setStepWidth, placeholder: '1', mode: 'decimal' as const },
              { label: 'Глубина ступени (м)', value: stepDepth, setValue: setStepDepth, placeholder: '0.4', mode: 'decimal' as const },
              { label: 'Высота ступени (м)', value: stepHeight, setValue: setStepHeight, placeholder: '0.2', mode: 'decimal' as const }
            ].map((field) => (
              <div key={field.label}>
                <label className="text-xs text-gray-400 block mb-2">{field.label}</label>
                <input
                  type="text"
                  inputMode={field.mode}
                  value={field.value}
                  onChange={(e) => field.setValue(e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={handleClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors">Отмена</button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}
