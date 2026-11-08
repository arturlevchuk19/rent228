import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { MobileHeaderContent } from '../components/MobileHeaderContent';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, DollarSign, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  getPaymentsByMonth,
  formatMonth,
  getFirstDayOfMonth,
  createPayment,
  updatePayment,
  deletePayment,
  PaymentWithDetails,
  Payment,
} from '../lib/payments';
import { getPersonnel, type Personnel } from '../lib/personnel';
import { getEvents, type Event } from '../lib/events';

/** Values collected by the payment form before they are mapped onto a Payment row. */
interface PaymentFormData {
  personnel_id: string;
  event_id: string;
  amount: number;
  status: Payment['status'];
  payment_date: string;
  notes: string;
}

export default function Payments() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentWithDetails | null>(null);
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [eventsList, setEventsList] = useState<Event[]>([]);

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
        return 'bg-green-950/60 text-green-300 border-green-800';
      case 'Запланировано':
        return 'bg-accent-900/40 text-accent-200 border-accent-700';
      case 'Просрочено':
        return 'bg-red-950/60 text-red-300 border-red-800';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700';
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

  async function handleSavePayment(paymentData: PaymentFormData) {
    try {
      if (editingPayment) {
        await updatePayment(editingPayment.id, paymentData);
      } else {
        await createPayment({
          ...paymentData,
          month: currentMonth,
          budget_item_id: null,
          work_item_id: null,
        });
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
      <div hidden>
        <h1 className="text-xl font-semibold text-white">Выплаты</h1>
        <MobileHeaderContent><button disabled={!canAccess(user, 'payments', 2)}
          onClick={() => setShowForm(true)}
          className="min-h-11 px-3 py-2 bg-accent-500 text-gray-950 font-semibold text-sm rounded-lg hover:bg-accent-400 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button></MobileHeaderContent>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPreviousMonth}
            aria-label="Предыдущий месяц"
            className="flex h-11 w-11 shrink-0 items-center justify-center hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-white">
              {formatMonth(currentMonth)}
            </h2>
            <button
              onClick={goToCurrentMonth}
              className="min-h-11 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
            >
              Сегодня
            </button>
          </div>

          <button
            onClick={goToNextMonth}
            aria-label="Следующий месяц"
            className="flex h-11 w-11 shrink-0 items-center justify-center hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 border-y border-gray-800 py-4 text-sm mb-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Всего:</span>
            <span className="font-semibold text-gray-100 tabular-nums">{totalAmount.toLocaleString('ru-RU')} BYN</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Выплачено:</span>
            <span className="font-semibold tabular-nums text-green-400">{paidAmount.toLocaleString('ru-RU')} BYN</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Запланировано:</span>
            <span className="font-semibold text-gray-100 tabular-nums">{plannedAmount.toLocaleString('ru-RU')} BYN</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Просрочено:</span>
            <span className="font-semibold tabular-nums text-red-400">{overdueAmount.toLocaleString('ru-RU')} BYN</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-accent-500"></div>
            <p className="mt-2 text-sm text-gray-400">Загрузка...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-10 h-10 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Нет выплат за этот месяц</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Сотрудник</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Мероприятие</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Работа</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Сумма</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-400">Статус</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Дата</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Действия</th>
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
                      <td className="px-3 py-2 text-sm text-right tabular-nums font-semibold text-gray-100">
                        {Number(payment.amount).toLocaleString('ru-RU')} BYN
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(payment.status)}`}>
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
                          <button disabled={!canAccess(user, 'payments', 2)}
                            onClick={() => handleEdit(payment)}
                            className="inline-flex min-h-11 min-w-11 md:min-h-9 md:min-w-9 items-center justify-center text-gray-300 hover:text-accent-300 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Редактировать"
                           aria-label="Редактировать"><Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button disabled={!canAccess(user, 'payments', 3)}
                            onClick={() => handleDelete(payment.id)}
                            className="inline-flex min-h-11 min-w-11 md:min-h-9 md:min-w-9 items-center justify-center text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Удалить"
                           aria-label="Удалить"><Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-gray-800 -mx-4">
              {payments.map((payment) => (
                <div key={payment.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm">{payment.personnel.full_name}</div>
                      {payment.event?.name && <div className="text-xs text-gray-400 truncate">{payment.event.name}</div>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button disabled={!canAccess(user, 'payments', 2)} onClick={() => handleEdit(payment)} className="inline-flex min-h-11 min-w-11 md:min-h-9 md:min-w-9 items-center justify-center text-gray-300 hover:text-accent-300 hover:bg-gray-800 rounded-lg transition-colors" aria-label="Редактировать"><Pencil className="w-4 h-4" />
                      </button>
                      <button disabled={!canAccess(user, 'payments', 3)} onClick={() => handleDelete(payment.id)} className="inline-flex min-h-11 min-w-11 md:min-h-9 md:min-w-9 items-center justify-center text-red-400 hover:bg-red-900/30 rounded-lg transition-colors" aria-label="Удалить"><Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-gray-100 tabular-nums font-semibold text-base">{Number(payment.amount).toLocaleString('ru-RU')} BYN</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(payment.status)}`}>
                      {payment.status}
                    </span>
                    {payment.payment_date && (
                      <span className="text-xs text-gray-400">{new Date(payment.payment_date).toLocaleDateString('ru-RU')}</span>
                    )}
                  </div>
                  {payment.work_item?.name && (
                    <div className="text-xs text-gray-500">{payment.work_item.name}</div>
                  )}
                </div>
              ))}
            </div>
          </>
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
  personnelList: Personnel[];
  eventsList: Event[];
  onSave: (data: PaymentFormData) => void;
  onClose: () => void;
}

function PaymentFormModal({ payment, personnelList, eventsList, onSave, onClose }: PaymentFormModalProps) {
  const [formData, setFormData] = useState<PaymentFormData>({
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
    <div role="dialog" aria-modal="true" aria-label={payment ? "Редактировать выплату" : "Новая выплата"} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3">
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-xl">
        <div className="shrink-0 border-b border-gray-800 p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-gray-100">
            {payment ? 'Редактировать выплату' : 'Новая выплата'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Сотрудник *
            </label>
            <select
              required
              value={formData.personnel_id}
              onChange={(e) => setFormData({ ...formData, personnel_id: e.target.value })}
              className="min-h-11 w-full px-4 py-2 border border-gray-700 bg-gray-800 text-gray-100 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Мероприятие (опционально)
            </label>
            <select
              value={formData.event_id}
              onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
              className="min-h-11 w-full px-4 py-2 border border-gray-700 bg-gray-800 text-gray-100 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Сумма (BYN) *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              className="min-h-11 w-full px-4 py-2 border border-gray-700 bg-gray-800 text-gray-100 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Статус *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Payment['status'] })}
              className="min-h-11 w-full px-4 py-2 border border-gray-700 bg-gray-800 text-gray-100 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            >
              <option value="Запланировано">Запланировано</option>
              <option value="Выплачено">Выплачено</option>
              <option value="Просрочено">Просрочено</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Дата выплаты
            </label>
            <input
              type="date"
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              className="min-h-11 w-full px-4 py-2 border border-gray-700 bg-gray-800 text-gray-100 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Примечания
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="min-h-11 w-full px-4 py-2 border border-gray-700 bg-gray-800 text-gray-100 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            />
          </div>

          </div>
          <div className="flex shrink-0 justify-end gap-3 border-t border-gray-800 p-4 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-4 py-2 text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="min-h-11 px-4 py-2 bg-accent-500 text-gray-950 font-semibold rounded-lg hover:bg-accent-400 transition-colors"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
