import React, { useState } from 'react';
import { X, Calculator } from 'lucide-react';
import { EquipmentItem } from '../../lib/equipment';

export interface DialogResult {
  quantity: number;
  customName: string;
  customPrice: number;
}

interface UShapeLedDialogProps {
  equipment: EquipmentItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: DialogResult) => void;
}

export function UShapeLedDialog({ equipment, isOpen, onClose, onConfirm }: UShapeLedDialogProps) {
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [supportCount, setSupportCount] = useState('0');
  const [supportLength, setSupportLength] = useState('');
  const [hoistType, setHoistType] = useState<'manual' | 'motor'>('manual');

  if (!isOpen) return null;

  const handleClose = () => {
    setWidth('');
    setHeight('');
    setSupportCount('0');
    setSupportLength('');
    setHoistType('manual');
    onClose();
  };

  const handleConfirm = () => {
    if (!width || !height) return;

    const widthNum = parseFloat(width);
    const heightNum = parseFloat(height);
    const supportCountNum = parseInt(supportCount, 10) || 0;

    if (supportCountNum > 0 && !supportLength) return;

    const supportLengthNum = supportCountNum > 0 ? parseFloat(supportLength) : 0;
    const hoistPrice = hoistType === 'manual' ? 20 : 80;

    let totalPrice: number;
    if (supportCountNum > 0) {
      totalPrice = widthNum * 7 + heightNum * 2 * 5 + supportCountNum * supportLengthNum * 5 + 10 + 5 + hoistPrice;
    } else {
      totalPrice = widthNum * 7 + heightNum * 2 * 5 + 10 + 10 + 5 + hoistPrice;
    }

    const hoistLabel = hoistType === 'manual' ? 'ручных талей' : 'электрических лебёдок';
    const baseLabel = `размером ${widthNum}x${heightNum}м, оснащенная системой подъёма на базе ${hoistLabel}`;
    let customName = baseLabel;
    if (supportCountNum === 2) {
      customName = `${baseLabel} с двумя упорами длиной ${supportLengthNum}м`;
    } else if (supportCountNum === 4) {
      customName = `${baseLabel} с четырьмя упорами длиной ${supportLengthNum}м`;
    }

    onConfirm({
      quantity: 1,
      customName,
      customPrice: totalPrice
    });

    handleClose();
  };

  const supportCountNum = parseInt(supportCount, 10) || 0;
  const totalPrice = (() => {
    if (!width || !height) return null;
    if (supportCountNum > 0 && !supportLength) return null;

    const widthNum = parseFloat(width);
    const heightNum = parseFloat(height);
    const supportLengthNum = supportCountNum > 0 ? parseFloat(supportLength) : 0;
    const hoistPrice = hoistType === 'manual' ? 20 : 80;

    let calculatedPrice: number;
    if (supportCountNum > 0) {
      calculatedPrice = widthNum * 7 + heightNum * 2 * 5 + supportCountNum * supportLengthNum * 5 + 10 + 5 + hoistPrice;
    } else {
      calculatedPrice = widthNum * 7 + heightNum * 2 * 5 + 10 + 10 + 5 + hoistPrice;
    }

    return calculatedPrice;
  })();

  const isValid = width !== '' && height !== '' && (supportCountNum <= 0 || supportLength !== '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-[420px] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-white">П-образная конструкция с системой подъема</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Оборудование</p>
            <p className="text-sm font-medium text-white">{equipment.name}</p>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-2">Ширина(м) K4-390</label>
                <input
                  type="number"
                  step="0.1"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="например: 6"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-2">Высота(м) K4-290</label>
                <input
                  type="number"
                  step="0.1"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="например: 4"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-2">Количество упоров</label>
                <div className="flex gap-2">
                  {[0, 2, 4].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setSupportCount(option.toString());
                        if (option === 0) {
                          setSupportLength('');
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        supportCountNum === option
                          ? 'bg-cyan-600 text-white border-cyan-500'
                          : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-2">Длина упора (м)</label>
                <input
                  type="number"
                  step="0.1"
                  value={supportLength}
                  onChange={(e) => setSupportLength(e.target.value)}
                  placeholder="например: 2"
                  disabled={supportCountNum <= 0}
                  className={`w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none ${supportCountNum <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">Тип тали</label>
              <div className="flex gap-2">
                {[
                  { value: 'manual', label: 'ручная таль' },
                  { value: 'motor', label: 'мотор' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setHoistType(option.value as 'manual' | 'motor')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      hoistType === option.value
                        ? 'bg-cyan-600 text-white border-cyan-500'
                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {totalPrice !== null && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Стоимость</p>
                <p className="text-sm font-bold text-green-400">${totalPrice.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Отмена
          </button>
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
