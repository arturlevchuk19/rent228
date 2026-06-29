import { useState } from 'react';
import { Package, X } from 'lucide-react';

interface ExtraServicesDialogProps {
  isOpen: boolean;
  existingNames: string[];
  onClose: () => void;
  onConfirm: (payload: { name: string; showTotal: boolean }) => Promise<void> | void;
}

export function ExtraServicesDialog({ isOpen, existingNames, onClose, onConfirm }: ExtraServicesDialogProps) {
  const [name, setName] = useState('');
  const [showTotal, setShowTotal] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedName = name.trim().toLowerCase();
  const nameError = !name.trim()
    ? 'Название обязательно'
    : existingNames.some((existing) => existing.trim().toLowerCase() === normalizedName)
      ? 'Категория с таким названием уже существует'
      : '';

  if (!isOpen) return null;

  const handleClose = () => {
    setName('');
    setShowTotal(true);
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (nameError) return;

    setIsSubmitting(true);
    try {
      await onConfirm({ name: name.trim(), showTotal });
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[70] p-0 sm:p-4" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="bg-gray-900 border border-gray-800 rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-[420px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-bold text-white">Дополнительные услуги</h3>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto overscroll-contain flex-1">
          <div>
            <label className="text-xs text-gray-400 block mb-2">Название категории *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Доп услуги"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-violet-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTotal}
                onChange={(e) => setShowTotal(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
              />
              <span className="text-xs text-gray-300">Показывать итог по разделу</span>
            </label>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={handleClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={Boolean(nameError) || isSubmitting}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}