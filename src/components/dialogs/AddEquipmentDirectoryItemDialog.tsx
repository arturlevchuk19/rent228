import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { getErrorMessage } from '../../lib/errors';

interface AddEquipmentDirectoryItemDialogProps {
  isOpen: boolean;
  title: string;
  inputLabel: string;
  existingItems: string[];
  normalize?: (value: string) => string;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
}

const trimValue = (value: string) => value.trim();

export function AddEquipmentDirectoryItemDialog({
  isOpen,
  title,
  inputLabel,
  existingItems,
  normalize = trimValue,
  onClose,
  onConfirm
}: AddEquipmentDirectoryItemDialogProps) {
  const [value, setValue] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canonicalValue = normalize(value);
  const normalizedValue = canonicalValue.toLowerCase();
  const hasDuplicate = useMemo(
    () => existingItems.some((item) => normalize(item).toLowerCase() === normalizedValue),
    [existingItems, normalizedValue, normalize]
  );

  const error = !value.trim() ? 'Название обязательно' : hasDuplicate ? 'Такое значение уже существует' : '';

  if (!isOpen) return null;

  const close = () => {
    setValue('');
    setSaveError('');
    setIsSubmitting(false);
    onClose();
  };

  const submit = async () => {
    if (error || isSubmitting) return;
    setSaveError('');
    setIsSubmitting(true);
    try {
      await onConfirm(canonicalValue);
      close();
    } catch (caught) {
      setSaveError(getErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[70] p-0 sm:p-4" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="bg-gray-900 border border-gray-800 rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-[420px] max-h-[90vh] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-accent-500" />
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
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-accent-500 outline-none min-h-11"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Введите значение"
          />
          {saveError && <p role="alert" className="mt-1 text-xs text-red-400">{saveError}</p>}
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={close} className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={Boolean(error) || isSubmitting}
            className="min-h-11 px-4 py-2 bg-accent-500 hover:bg-accent-400 text-gray-950 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
