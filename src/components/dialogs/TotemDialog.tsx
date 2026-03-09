import React, { useState } from 'react';
import { X, Calculator } from 'lucide-react';
import { EquipmentItem } from '../../lib/equipment';

export interface DialogResult {
  quantity: number;
  customName: string;
  customPrice?: number;
}

interface TotemDialogProps {
  equipment: EquipmentItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: DialogResult) => void;
  isMonototem: boolean;
}

export function TotemDialog({ equipment, isOpen, onClose, onConfirm, isMonototem }: TotemDialogProps) {
  const [height, setHeight] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setHeight('');
    onClose();
  };

  const handleConfirm = () => {
    if (!height) return;

    const heightNum = parseFloat(height);
    const heightLabel = `${heightNum}м`;

    if (isMonototem) {
      onConfirm({
        quantity: 1,
        customName: heightLabel
      });
    } else {
      const totalPrice = heightNum <= 2 ? 10 : 10 + Math.ceil((heightNum - 2) / 0.5) * 5;
      onConfirm({
        quantity: 1,
        customName: heightLabel,
        customPrice: totalPrice
      });
    }

    handleClose();
  };

  const isValid = height !== '';
  const heightNum = height ? parseFloat(height) : null;
  const totalPrice = !isMonototem && heightNum !== null ? (heightNum <= 2 ? 10 : 10 + Math.ceil((heightNum - 2) / 0.5) * 5) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-[400px] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-white">
              {isMonototem ? 'Высота монототема' : 'Высота тотема'}
            </h3>
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
            <div>
              <label className="text-xs text-gray-400 block mb-2">Высота (м)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="например: 2.5"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              />
            </div>

            {!isMonototem && totalPrice !== null && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Расчет стоимости</p>
                <p className="text-xs text-gray-500 mb-2">
                  Базовая цена: $10 (до 2м)
                  <br />
                  +$5 за каждые 0.5м свыше 2м
                </p>
                <p className="text-sm font-bold text-green-400">
                  ${totalPrice.toFixed(2)}
                </p>
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
