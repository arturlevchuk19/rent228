import React, { useState } from 'react';
import { X, Calculator } from 'lucide-react';
import { EquipmentItem } from '../../lib/equipment';

export interface DialogResult {
  quantity: number;
  customName: string;
  customPrice: number;
}

interface PodiumDialogProps {
  equipment: EquipmentItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: DialogResult) => void;
}

export function PodiumDialog({ equipment, isOpen, onClose, onConfirm }: PodiumDialogProps) {
  const [width, setWidth] = useState('');
  const [depth, setDepth] = useState('');
  const [height, setHeight] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setWidth('');
    setDepth('');
    setHeight('');
    onClose();
  };

  const handleConfirm = () => {
    if (!width || !depth || !height) return;

    const widthNum = parseFloat(width);
    const depthNum = parseFloat(depth);
    const heightNum = parseFloat(height);
    const area = widthNum * depthNum;

    const customName = `${widthNum}x${depthNum}x${heightNum}`;
    const totalPrice = equipment.rental_price * area;

    onConfirm({
      quantity: 1,
      customName,
      customPrice: totalPrice
    });

    handleClose();
  };

  const isValid = width !== '' && depth !== '' && height !== '';
  const calculatedArea = width && depth ? parseFloat(width) * parseFloat(depth) : null;
  const totalPrice = calculatedArea !== null ? equipment.rental_price * calculatedArea : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-[400px] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-white">Размеры</h3>
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-2">Ширина (м)</label>
                <input
                  type="number"
                  step="0.1"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="4"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-2">Глубина (м)</label>
                <input
                  type="number"
                  step="0.1"
                  value={depth}
                  onChange={(e) => setDepth(e.target.value)}
                  placeholder="3"
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
                  placeholder="0.6"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
              </div>
            </div>

            {calculatedArea !== null && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Общая площадь</p>
                <p className="text-sm font-bold text-cyan-400">
                  {calculatedArea.toFixed(2)} м²
                </p>
              </div>
            )}

            {calculatedArea !== null && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Сумма ({equipment.rental_price}$ × {calculatedArea.toFixed(2)} м²)</p>
                <p className="text-sm font-bold text-green-400">
                  ${totalPrice!.toFixed(2)}
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
