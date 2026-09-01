import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface ExtraServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: { name: string; showSectionTotal: boolean }) => void;
}

export function ExtraServiceDialog({ isOpen, onClose, onConfirm }: ExtraServiceDialogProps) {
  const [name, setName] = useState('Дополнительные услуги');
  const [showSectionTotal, setShowSectionTotal] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setName('Дополнительные услуги');
    setShowSectionTotal(false);
    onClose();
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onConfirm({ name: trimmedName, showSectionTotal });
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[70] p-0 sm:p-4" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="bg-gray-900 border border-gray-800 rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-[420px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-bold text-white">Дополнительные услуги</h3>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto overscroll-contain flex-1">
          <div>
            <label className="text-xs text-gray-400 block mb-2">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Дополнительные услуги"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showSectionTotal"
              checked={showSectionTotal}
              onChange={(e) => setShowSectionTotal(e.target.checked)}
              className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-0"
            />
            <label htmlFor="showSectionTotal" className="text-xs text-gray-300 cursor-pointer select-none">
              Отображать итого раздела
            </label>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={handleClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}
