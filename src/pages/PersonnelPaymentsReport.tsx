import { useState, useEffect } from 'react';
import { DollarSign, FileText, Calendar } from 'lucide-react';
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
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-cyan-500" />
          <h1 className="text-2xl font-bold text-white">Отчет по выплатам</h1>
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
            className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
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
        )}

        {!selectedPersonnelId ? (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Выберите сотрудника для просмотра отчета</p>
          </div>
        ) : loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500"></div>
            <p className="mt-2 text-sm text-gray-400">Загрузка...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-10 h-10 text-gray-600 mx-auto mb-2" />
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
                  <div className="bg-gray-800/50 px-4 py-2 border-b border-gray-800">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-white text-sm uppercase tracking-wider">{monthName}</h3>
                      <p className="font-bold text-white">
                        {monthTotal.toLocaleString('ru-RU')} BYN
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-800 bg-gray-900/50">
                          <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Мероприятие</th>
                          <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Работа</th>
                          <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">Сумма</th>
                          <th className="px-4 py-2 text-center text-[11px] font-medium text-gray-400 tracking-wider">Статус</th>
                          <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Дата</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {monthPayments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-800/30 transition-colors text-sm">
                            <td className="px-4 py-2 text-white">
                              {payment.event?.name || '—'}
                            </td>
                            <td className="px-4 py-2 text-gray-400 text-xs">
                              {payment.work_item?.name || '—'}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-white">
                              {Number(payment.amount).toLocaleString('ru-RU')} BYN
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                payment.status === 'Выплачено'
                                  ? 'bg-green-900/30 text-green-400 border-green-600/30'
                                  : payment.status === 'Запланировано'
                                  ? 'bg-blue-900/30 text-blue-400 border-blue-600/30'
                                  : 'bg-red-900/30 text-red-400 border-red-600/30'
                              }`}>
                                {payment.status}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-400 text-xs">
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
