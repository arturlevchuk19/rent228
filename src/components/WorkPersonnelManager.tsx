import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { BudgetItem } from '../lib/events';
import { Personnel, getPersonnel, assignPersonnelToBudgetItem, getBudgetItemPersonnel } from '../lib/personnel';

interface WorkPersonnelManagerProps {
  workItems: BudgetItem[];
  onClose: () => void;
  onSave: () => void;
  paymentMode: 'usd' | 'byn_cash' | 'byn_noncash';
  exchangeRate: number;
}

interface WorkPersonnelAssignment {
  budgetItemId: string;
  personnelIds: string[];
}

export function WorkPersonnelManager({ workItems, onClose, onSave, paymentMode, exchangeRate }: WorkPersonnelManagerProps) {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [workItems]);

  const loadData = async () => {
    try {
      setLoading(true);
      const personnelData = await getPersonnel();
      setPersonnel(personnelData);

      const assignmentsMap: Record<string, string[]> = {};
      const expandedMap: Record<string, boolean> = {};

      for (const item of workItems) {
        const assigned = await getBudgetItemPersonnel(item.id);
        assignmentsMap[item.id] = assigned.map(p => p.id);
        expandedMap[item.id] = true;
      }

      setAssignments(assignmentsMap);
      setExpandedItems(expandedMap);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePersonnel = (budgetItemId: string, personnelId: string) => {
    const currentAssignments = assignments[budgetItemId] || [];
    const isAssigned = currentAssignments.includes(personnelId);

    const newAssignments = isAssigned
      ? currentAssignments.filter(id => id !== personnelId)
      : [...currentAssignments, personnelId];

    setAssignments({
      ...assignments,
      [budgetItemId]: newAssignments
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      for (const [budgetItemId, personnelIds] of Object.entries(assignments)) {
        await assignPersonnelToBudgetItem(budgetItemId, personnelIds);
      }

      alert('Персонал успешно назначен');
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error saving assignments:', error);
      alert(`Ошибка сохранения: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const calculateBYN = (priceUSD: number, quantity: number): number => {
    const baseAmount = priceUSD * exchangeRate * quantity;
    const withMarkup = baseAmount * 1.2;
    return Math.round(withMarkup / 5) * 5;
  };

  const calculatePersonnelShare = (item: BudgetItem): number => {
    const assignedCount = (assignments[item.id] || []).length;
    if (assignedCount === 0) return 0;

    const showInBYN = paymentMode === 'byn_cash' || paymentMode === 'byn_noncash';
    const totalAmount = showInBYN
      ? calculateBYN(item.price, item.quantity)
      : item.price * item.quantity;

    return totalAmount / assignedCount;
  };

  const calculatePersonnelAmount = (item: BudgetItem, person: Personnel): number => {
    const baseShare = calculatePersonnelShare(item);
    return baseShare * (person.rate_percentage / 100);
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems({
      ...expandedItems,
      [itemId]: !expandedItems[itemId]
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 p-8 rounded-lg">
          <p className="text-white">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Управление персоналом работ</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {workItems.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              В смете нет работ. Добавьте работы, чтобы назначить на них персонал.
            </p>
          ) : (
            workItems.map(item => {
              const assignedPersonnel = (assignments[item.id] || [])
                .map(id => personnel.find(p => p.id === id))
                .filter(Boolean) as Personnel[];
              const isExpanded = expandedItems[item.id];
              const showInBYN = paymentMode === 'byn_cash' || paymentMode === 'byn_noncash';
              const totalAmount = showInBYN
                ? calculateBYN(item.price, item.quantity)
                : item.price * item.quantity;

              return (
                <div key={item.id} className="bg-gray-800 rounded-lg border border-gray-700">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-750 transition-colors"
                    onClick={() => toggleExpanded(item.id)}
                  >
                    <button className="text-gray-400 hover:text-white transition-colors">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>

                    <div className="flex-1">
                      <h3 className="text-white font-semibold">{item.work_item?.name || 'Без названия'}</h3>
                      <p className="text-sm text-gray-400">
                        Количество: {item.quantity} | Цена: ${item.price.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-cyan-400 font-semibold">
                        {showInBYN ? `${totalAmount.toFixed(2)} BYN` : `$${totalAmount.toFixed(2)}`}
                      </p>
                      <p className="text-sm text-gray-400">
                        {assignedPersonnel.length} {assignedPersonnel.length === 1 ? 'человек' : 'человек'}
                      </p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-700 p-4">
                      <div className="space-y-2">
                        {personnel.length === 0 ? (
                          <p className="text-gray-400 text-sm">Нет доступного персонала</p>
                        ) : (
                          personnel.map(person => {
                            const isAssigned = (assignments[item.id] || []).includes(person.id);
                            const amount = isAssigned ? calculatePersonnelAmount(item, person) : 0;

                            return (
                              <div
                                key={person.id}
                                className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg hover:bg-gray-850 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() => handleTogglePersonnel(item.id, person.id)}
                                  className="w-4 h-4 rounded"
                                />

                                <div className="flex-1">
                                  <p className="text-white">{person.full_name}</p>
                                  <p className="text-xs text-gray-400">
                                    Ставка: {person.rate_percentage}%
                                  </p>
                                </div>

                                {isAssigned && (
                                  <div className="text-right">
                                    <p className="text-green-400 font-semibold">
                                      {showInBYN ? `${amount.toFixed(2)} BYN` : `$${amount.toFixed(2)}`}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      К выплате
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {assignedPersonnel.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">На человека (базовая доля):</span>
                            <span className="text-white font-semibold">
                              {showInBYN
                                ? `${calculatePersonnelShare(item).toFixed(2)} BYN`
                                : `$${calculatePersonnelShare(item).toFixed(2)}`
                              }
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
