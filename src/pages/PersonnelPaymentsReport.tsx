import { useState, useEffect } from 'react';
import { DollarSign, FileText } from 'lucide-react';
import { getPersonnel, Personnel } from '../lib/personnel';
import { getPaymentsByPersonnel, PaymentWithDetails } from '../lib/payments';

export default function PersonnelPaymentsReport() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>('');
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPersonnel();
  }, []);

  useEffect(() => {
    if (selectedPersonnelId) {
      loadPayments();
    } else {
      setPayments([]);
    }
  }, [selectedPersonnelId]);

  async function loadPersonnel() {
    try {
      const data = await getPersonnel();
      setPersonnel(data);
    } catch (error) {
      console.error('Error loading personnel:', error);
    }
  }

  async function loadPayments() {
    try {
      setLoading(true);
      const data = await getPaymentsByPersonnel(selectedPersonnelId);
      setPayments(data);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  }

  const selectedPerson = personnel.find(p => p.id === selectedPersonnelId);

  const paymentsByMonth: Record<string, PaymentWithDetails[]> = {};
  payments.forEach(payment => {
    const month = payment.month;
    if (!paymentsByMonth[month]) {
      paymentsByMonth[month] = [];
    }
    paymentsByMonth[month].push(payment);
  });

  const sortedMonths = Object.keys(paymentsByMonth).sort().reverse();

  const calculateMonthTotal = (monthPayments: PaymentWithDetails[]): number => {
    return monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  };

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const paidAmount = payments
    .filter(p => p.status === 'Выплачено')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const plannedAmount = payments
    .filter(p => p.status === 'Запланировано')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const overdueAmount = payments
    .filter(p => p.status === 'Просрочено')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <div hidden>
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-accent-500" />
          <h1 className="text-xl font-semibold text-white">Отчет по выплатам</h1>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <div className="mb-4 max-w-md">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Выберите сотрудника
          </label>
          <select
            value={selectedPersonnelId}
            onChange={(e) => setSelectedPersonnelId(e.target.value)}
            className="min-h-11 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-accent-500"
          >
            <option value="">— Все сотрудники —</option>
            {personnel.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name} ({person.rate_percentage}%)
              </option>
            ))}
          </select>
        </div>

        {selectedPerson && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700 text-sm mb-4">
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
        )}

        {!selectedPersonnelId ? (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Выберите сотрудника для просмотра отчета</p>
          </div>
        ) : loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-accent-500"></div>
            <p className="mt-2 text-sm text-gray-400">Загрузка...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-10 h-10 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Нет выплат для выбранного сотрудника</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedMonths.map((month) => {
              const monthPayments = paymentsByMonth[month];
              const monthTotal = calculateMonthTotal(monthPayments);
              const monthDate = new Date(month);
              const monthName = monthDate.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' });

              return (
                <div key={month} className="border border-gray-800 rounded-lg overflow-hidden">
                  <div className="bg-gray-950 px-4 py-4 border-b border-gray-800">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <h3 className="font-semibold text-gray-100 text-lg">{monthName}</h3>
                      <p className="font-semibold text-gray-100 tabular-nums">
                        {monthTotal.toLocaleString('ru-RU')} BYN
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-800 bg-gray-900/50">
                          <th className="min-h-11 px-4 py-2 text-left text-xs font-medium text-gray-400">Мероприятие</th>
                          <th className="min-h-11 px-4 py-2 text-left text-xs font-medium text-gray-400">Работа</th>
                          <th className="min-h-11 px-4 py-2 text-right text-xs font-medium text-gray-400">Сумма</th>
                          <th className="min-h-11 px-4 py-2 text-center text-xs font-medium text-gray-400">Статус</th>
                          <th className="min-h-11 px-4 py-2 text-left text-xs font-medium text-gray-400">Дата</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {monthPayments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-800/30 transition-colors text-sm">
                            <td className="min-h-11 px-4 py-2 text-white">
                              {payment.event?.name || '—'}
                            </td>
                            <td className="min-h-11 px-4 py-2 text-gray-400 text-xs">
                              {payment.work_item?.name || '—'}
                            </td>
                            <td className="min-h-11 px-4 py-2 text-right tabular-nums font-semibold text-gray-100">
                              {Number(payment.amount).toLocaleString('ru-RU')} BYN
                            </td>
                            <td className="min-h-11 px-4 py-2 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium border ${
                                payment.status === 'Выплачено'
                                  ? 'bg-green-900/30 text-green-400 border-green-600/30'
                                  : payment.status === 'Запланировано'
                                  ? 'bg-accent-900/40 text-accent-200 border-accent-700/60'
                                  : 'bg-red-900/30 text-red-400 border-red-600/30'
                              }`}>
                                {payment.status}
                              </span>
                            </td>
                            <td className="min-h-11 px-4 py-2 text-gray-400 text-xs">
                              {payment.payment_date
                                ? new Date(payment.payment_date).toLocaleDateString('ru-RU')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
