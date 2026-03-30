import React, { useMemo, useState } from 'react';
import { MapPin, X } from 'lucide-react';

interface AddLocationDialogProps {
  isOpen: boolean;
  existingNames: string[];
  onClose: () => void;
  onConfirm: (payload: { name: string; color: string }) => Promise<void> | void;
}

const DEFAULT_COLOR = '#0e7490';

export function AddLocationDialog({ isOpen, existingNames, onClose, onConfirm }: AddLocationDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedName = name.trim().toLowerCase();
  const hasDuplicate = useMemo(
    () => existingNames.some((existing) => existing.trim().toLowerCase() === normalizedName),
    [existingNames, normalizedName]
  );

  const nameError = !name.trim()
    ? 'Название обязательно'
    : hasDuplicate
      ? 'Локация с таким названием уже есть в этом событии'
      : '';

  if (!isOpen) return null;

  const handleClose = () => {
    setName('');
    setColor(DEFAULT_COLOR);
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (nameError) return;

    setIsSubmitting(true);
    try {
      await onConfirm({ name: name.trim(), color });
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
            <MapPin className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-white">Добавить локацию</h3>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto overscroll-contain flex-1">
          <div>
            <label className="text-xs text-gray-400 block mb-2">Название *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Главная сцена"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Цвет</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 rounded border border-gray-700 bg-gray-800 cursor-pointer"
              />
              <span className="text-xs text-gray-400">{color}</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={handleClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={Boolean(nameError) || isSubmitting}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}
