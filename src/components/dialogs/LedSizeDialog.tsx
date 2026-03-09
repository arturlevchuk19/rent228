import React, { useState } from 'react';
import { X, Calculator } from 'lucide-react';
import { EquipmentItem } from '../../lib/equipment';

export interface DialogResult {
  quantity: number;
  customName: string;
  customPrice: number;
}

interface LedSizeDialogProps {
  equipment: EquipmentItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: DialogResult) => void;
}

export function LedSizeDialog({ equipment, isOpen, onClose, onConfirm }: LedSizeDialogProps) {
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [area, setArea] = useState('');
  const [sizeType, setSizeType] = useState<'dimensions' | 'area'>('dimensions');

  const formatArea = (value: number): string => {
    return parseFloat(value.toFixed(2)).toString();
  };

  if (!isOpen) return null;

  const handleClose = () => {
    setWidth('');
    setHeight('');
    setArea('');
    onClose();
  };

  const handleConfirm = () => {
    let calculatedArea: number;
    let customName: string;

    if (sizeType === 'dimensions') {
      if (!width || !height) return;
      calculatedArea = parseFloat(width) * parseFloat(height);
      customName = `(${width}x${height}м)`;
    } else {
      if (!area) return;
      calculatedArea = parseFloat(area);
      customName = `(${formatArea(calculatedArea)} м.кв.)`;
    }

    const totalPrice = equipment.rental_price * calculatedArea;

    onConfirm({
      quantity: 1,
      customName,
      customPrice: totalPrice
    });

    handleClose();
  };

  const calculatedArea = sizeType === 'dimensions' ? (width && height ? parseFloat(width) * parseFloat(height) : null) : (area ? parseFloat(area) : null);
  const totalPrice = calculatedArea !== null ? equipment.rental_price * calculatedArea : null;
  const isValid = sizeType === 'dimensions' ? (width !== '' && height !== '') : (area !== '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-[400px] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-white">Размер экрана</h3>
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
            <div className="flex bg-gray-800 p-0.5 rounded-lg">
              <button
                onClick={() => { setSizeType('dimensions'); setArea(''); }}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                  sizeType === 'dimensions' ? 'bg-gray-700 text-cyan-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Размеры
              </button>
              <button
                onClick={() => { setSizeType('area'); setWidth(''); setHeight(''); }}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                  sizeType === 'area' ? 'bg-gray-700 text-cyan-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Площадь
              </button>
            </div>

            {sizeType === 'dimensions' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Ширина (м)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="например: 4"
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
                    placeholder="например: 3"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-400 block mb-2">Площадь (м²)</label>
                <input
                  type="number"
                  step="0.1"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="например: 12"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
              </div>
            )}

            {calculatedArea !== null && (
              <>
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Общая площадь</p>
                  <p className="text-sm font-bold text-cyan-400">
                    {calculatedArea.toFixed(2)} м²
                  </p>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Сумма ({equipment.rental_price}$ × {calculatedArea.toFixed(2)} м²)</p>
                  <p className="text-sm font-bold text-green-400">
                    ${totalPrice!.toFixed(2)}
                  </p>
                </div>
              </>
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
