import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, DollarSign, CheckCircle, Clock, AlertCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  getPaymentsByMonth,
  getMonthsWithPayments,
  formatMonth,
  getFirstDayOfMonth,
  createPayment,
  updatePayment,
  deletePayment,
  PaymentWithDetails,
} from '../lib/payments';
import { getPersonnel } from '../lib/personnel';
import { getEvents } from '../lib/events';

export default function Payments() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentWithDetails | null>(null);
  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [eventsList, setEventsList] = useState<any[]>([]);

  const currentMonth = getFirstDayOfMonth(selectedDate.getFullYear(), selectedDate.getMonth());

  useEffect(() => {
    loadPayments();
    loadPersonnel();
    loadEvents();
  }, [currentMonth]);

  async function loadPayments() {
    try {
      setLoading(true);
      const data = await getPaymentsByMonth(currentMonth);
      setPayments(data);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPersonnel() {
    try {
      const data = await getPersonnel();
      setPersonnelList(data);
    } catch (error) {
      console.error('Error loading personnel:', error);
    }
  }

  async function loadEvents() {
    try {
      const data = await getEvents();
      setEventsList(data);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }

  function goToPreviousMonth() {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  }

  function goToNextMonth() {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  }

  function goToCurrentMonth() {
    setSelectedDate(new Date());
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'Выплачено':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Запланировано':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Просрочено':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'Выплачено':
        return <CheckCircle className="w-4 h-4" />;
      case 'Запланировано':
        return <Clock className="w-4 h-4" />;
      case 'Просрочено':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  }

  const totalAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const paidAmount = payments
    .filter(p => p.status === 'Выплачено')
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const plannedAmount = payments
    .filter(p => p.status === 'Запланировано')
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const overdueAmount = payments
    .filter(p => p.status === 'Просрочено')
    .reduce((sum, payment) => sum + Number(payment.amount), 0);

  async function handleDelete(id: string) {
    if (!confirm('Вы уверены, что хотите удалить эту выплату?')) return;

    try {
      await deletePayment(id);
      loadPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Ошибка при удалении выплаты');
    }
  }

  function handleEdit(payment: PaymentWithDetails) {
    setEditingPayment(payment);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingPayment(null);
  }

  async function handleSavePayment(paymentData: any) {
    try {
      if (editingPayment) {
        await updatePayment(editingPayment.id, paymentData);
      } else {
        await createPayment({ ...paymentData, month: currentMonth });
      }
      loadPayments();
      handleCloseForm();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Ошибка при сохранении выплаты');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Выплаты</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPreviousMonth}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h2 className="text-xl font-semibold text-white">
              {formatMonth(currentMonth)}
            </h2>
            <button
              onClick={goToCurrentMonth}
              className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
            >
              Сегодня
            </button>
          </div>

          <button
            onClick={goToNextMonth}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700 text-sm mb-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Всего:</span>
            <span className="font-bold text-white">{totalAmount.toLocaleString('ru-RU')} BYN</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Выплачено:</span>
            <span className="font-bold text-green-400">{paidAmount.toLocaleString('ru-RU')} BYN</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Запланировано:</span>
            <span className="font-bold text-blue-400">{plannedAmount.toLocaleString('ru-RU')} BYN</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Просрочено:</span>
            <span className="font-bold text-red-400">{overdueAmount.toLocaleString('ru-RU')} BYN</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-sm text-gray-400">Загрузка...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Нет выплат за этот месяц</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Сотрудник</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Мероприятие</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Работа</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">Сумма</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-gray-400 tracking-wider">Статус</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Дата</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-3 py-2 text-sm text-white font-medium">
                      {payment.personnel.full_name}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-400">
                      {payment.event?.name || '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-400">
                      {payment.work_item?.name || '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-medium text-white">
                      {Number(payment.amount).toLocaleString('ru-RU')} BYN
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-400">
                      {payment.payment_date
                        ? new Date(payment.payment_date).toLocaleDateString('ru-RU')
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(payment)}
                          className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(payment.id)}
                          className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <PaymentFormModal
          payment={editingPayment}
          personnelList={personnelList}
          eventsList={eventsList}
          onSave={handleSavePayment}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}

interface PaymentFormModalProps {
  payment: PaymentWithDetails | null;
  personnelList: any[];
  eventsList: any[];
  onSave: (data: any) => void;
  onClose: () => void;
}

function PaymentFormModal({ payment, personnelList, eventsList, onSave, onClose }: PaymentFormModalProps) {
  const [formData, setFormData] = useState({
    personnel_id: payment?.personnel_id || '',
    event_id: payment?.event_id || '',
    amount: payment?.amount || 0,
    status: payment?.status || 'Запланировано',
    payment_date: payment?.payment_date || '',
    notes: payment?.notes || '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {payment ? 'Редактировать выплату' : 'Новая выплата'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Сотрудник *
            </label>
            <select
              required
              value={formData.personnel_id}
              onChange={(e) => setFormData({ ...formData, personnel_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Выберите сотрудника</option>
              {personnelList.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Мероприятие (опционально)
            </label>
            <select
              value={formData.event_id}
              onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Не привязано к мероприятию</option>
              {eventsList.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Сумма (BYN) *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Статус *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Запланировано">Запланировано</option>
              <option value="Выплачено">Выплачено</option>
              <option value="Просрочено">Просрочено</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Дата выплаты
            </label>
            <input
              type="date"
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Примечания
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
