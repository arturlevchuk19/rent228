import React, { useState } from 'react';
import { X } from 'lucide-react';
import { createClient, updateClient, Client } from '../lib/events';

interface ClientFormProps {
  client?: Client;
  onClose: () => void;
  onSave: () => void;
}

export function ClientForm({ client, onClose, onSave }: ClientFormProps) {
  const [formData, setFormData] = useState({
    organization: client?.organization || '',
    full_name: client?.full_name || '',
    signatory_initials: client?.signatory_initials || '',
    position: client?.position || '',
    signatory_position_ip: client?.signatory_position_ip || '',
    basis_for_action: client?.basis_for_action || '',
    unp: client?.unp || '',
    legal_address: client?.legal_address || '',
    postal_address: client?.postal_address || '',
    bank_details: client?.bank_details || '',
    phone: client?.phone || '',
    email: client?.email || '',
    notes: client?.notes || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.organization.trim()) {
      alert('Укажите название организации');
      return;
    }

    try {
      setSaving(true);
      if (client) {
        await updateClient(client.id, formData);
      } else {
        await createClient(formData);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">
            {client ? 'Редактировать заказчика' : 'Новый заказчик'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Организация <span className="text-red-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 resize-y"
                placeholder="ООО Компания"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ФИО подписанта (в Р.П.)
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="Иванов Иван Иванович"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Инициалы подписанта (в И.П.)
              </label>
              <input
                type="text"
                value={formData.signatory_initials}
                onChange={(e) => setFormData({ ...formData, signatory_initials: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="И.И. Иванов"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Должность подписанта (в Р.П.)
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="директора"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Должность подписанта (в И.П.)
              </label>
              <input
                type="text"
                value={formData.signatory_position_ip}
                onChange={(e) => setFormData({ ...formData, signatory_position_ip: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="Директор"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Действующего на основании
              </label>
              <input
                type="text"
                value={formData.basis_for_action}
                onChange={(e) => setFormData({ ...formData, basis_for_action: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="Устава"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                УНП
              </label>
              <input
                type="text"
                value={formData.unp}
                onChange={(e) => setFormData({ ...formData, unp: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="123456789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Юр. адрес
              </label>
              <input
                type="text"
                value={formData.legal_address}
                onChange={(e) => setFormData({ ...formData, legal_address: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="г. Минск, ул. Примерная, 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Почтовый адрес
              </label>
              <input
                type="text"
                value={formData.postal_address}
                onChange={(e) => setFormData({ ...formData, postal_address: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="220000, г. Минск, а/я 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Банковские реквизиты
              </label>
              <textarea
                value={formData.bank_details}
                onChange={(e) => setFormData({ ...formData, bank_details: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="р/с, БИК, банк..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Телефон
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="+375 29 123-45-67"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Примечания
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 resize-none"
                placeholder="Дополнительная информация..."
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
