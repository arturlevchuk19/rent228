import React, { useState, useEffect } from 'react';
import { FileSignature, X, Building2 } from 'lucide-react';
import { getClients, Client } from '../../lib/events';

interface ContractDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: { date: string; equipmentTypeRP: string; clientId: string; clientOrganization: string }) => Promise<void> | void;
}

export function ContractDialog({ isOpen, onClose, onConfirm }: ContractDialogProps) {
  const [contractDate, setContractDate] = useState(new Date().toISOString().slice(0, 10));
  const [equipmentTypeRP, setEquipmentTypeRP] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);

  const loadClients = async () => {
    try {
      const clientsData = await getClients();
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const dateError = !contractDate ? 'Дата обязательна' : '';
  const equipmentError = !equipmentTypeRP.trim() ? 'Вид оборудования обязателен' : '';

  if (!isOpen) return null;

  const handleClose = () => {
    setContractDate(new Date().toISOString().slice(0, 10));
    setEquipmentTypeRP('');
    setSelectedClientId('');
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (dateError || equipmentError) return;

    setIsSubmitting(true);
    try {
      const selectedClient = clients.find(c => c.id === selectedClientId);
      await onConfirm({
        date: contractDate,
        equipmentTypeRP: equipmentTypeRP.trim(),
        clientId: selectedClientId,
        clientOrganization: selectedClient?.organization || ''
      });
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
            <FileSignature className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-white">Договор</h3>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto overscroll-contain flex-1">
          <div>
            <label className="text-xs text-gray-400 block mb-2">Дата создания договора *</label>
            <input
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
            />
            {dateError && <p className="text-xs text-red-400 mt-1">{dateError}</p>}
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Организация</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
              >
                <option value="">Выберите организацию</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.organization}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Вид оборудования (в Р.П) *</label>
            <input
              type="text"
              value={equipmentTypeRP}
              onChange={(e) => setEquipmentTypeRP(e.target.value)}
              placeholder="Например: светодиодном оборудовании"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {equipmentError && <p className="text-xs text-red-400 mt-1">{equipmentError}</p>}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={handleClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={Boolean(dateError || equipmentError) || isSubmitting}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}
