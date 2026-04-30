import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

interface AddEquipmentDirectoryItemDialogProps {
  isOpen: boolean;
  title: string;
  inputLabel: string;
  existingItems: string[];
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
}

export function AddEquipmentDirectoryItemDialog({
  isOpen,
  title,
  inputLabel,
  existingItems,
  onClose,
  onConfirm
}: AddEquipmentDirectoryItemDialogProps) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedValue = value.trim().toLowerCase();
  const hasDuplicate = useMemo(
    () => existingItems.some((item) => item.trim().toLowerCase() === normalizedValue),
    [existingItems, normalizedValue]
  );

  const error = !value.trim() ? 'Название обязательно' : hasDuplicate ? 'Такое значение уже существует' : '';

  if (!isOpen) return null;

  const close = () => {
    setValue('');
    setIsSubmitting(false);
    onClose();
  };

  const submit = async () => {
    if (error) return;
    setIsSubmitting(true);
    try {
      await onConfirm(value.trim());
      close();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[70] p-0 sm:p-4" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="bg-gray-900 border border-gray-800 rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-[420px] max-h-[90vh] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-white">{title}</h3>
          </div>
          <button onClick={close} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <label className="text-xs text-gray-400 block mb-2">{inputLabel}</label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Введите значение"
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={close} className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={Boolean(error) || isSubmitting}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
