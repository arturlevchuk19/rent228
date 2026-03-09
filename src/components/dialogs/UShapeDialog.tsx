import React, { useState } from 'react';
import { X, Calculator } from 'lucide-react';
import { EquipmentItem } from '../../lib/equipment';

export interface DialogResult {
  quantity: number;
  customName: string;
  customPrice: number;
}

interface UShapeDialogProps {
  equipment: EquipmentItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: DialogResult) => void;
}

const roundToFive = (value: number) => Math.round(value / 5) * 5;

export function UShapeDialog({ equipment, isOpen, onClose, onConfirm }: UShapeDialogProps) {
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [supportCount, setSupportCount] = useState('0');
  const [supportLength, setSupportLength] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setWidth('');
    setHeight('');
    setSupportCount('0');
    setSupportLength('');
    onClose();
  };

  const handleConfirm = () => {
    if (!width || !height) return;

    const widthNum = parseFloat(width);
    const heightNum = parseFloat(height);
    const supportCountNum = parseInt(supportCount, 10) || 0;

    if (supportCountNum > 0 && !supportLength) return;

    const supportLengthNum = supportCountNum > 0 ? parseFloat(supportLength) : 0;
    const baseTotal = supportCountNum > 0
      ? (widthNum + (heightNum * 2) + 4 + (supportCountNum * supportLengthNum)) * 5
      : (widthNum + (heightNum * 2) + 2) * 5 + 10;
    const totalPrice = roundToFive(baseTotal);

    const baseLabel = `размером ${widthNum}x${heightNum}м`;
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

    const baseTotal = supportCountNum > 0
      ? (widthNum + (heightNum * 2) + 4 + (supportCountNum * supportLengthNum)) * 5
      : (widthNum + (heightNum * 2) + 2) * 5 + 10;

    return roundToFive(baseTotal);
  })();

  const isValid = width !== '' && height !== '' && (supportCountNum <= 0 || supportLength !== '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-[420px] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-white">П-образная конструкция</h3>
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
                <label className="text-xs text-gray-400 block mb-2">Ширина (м)</label>
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
                <label className="text-xs text-gray-400 block mb-2">Высота (м)</label>
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
