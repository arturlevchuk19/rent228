import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { getErrorMessage } from '../lib/errors';
import { MobileHeaderContent } from '../components/MobileHeaderContent';
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { getPersonnel, createPersonnel, updatePersonnel, deletePersonnel, type Personnel } from '../lib/personnel';

const input = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-cyan-500';
type Employment = 'staff' | 'freelance';
const blank = (employment_type: Employment) => ({ full_name: '', show_in_budgets: true, employment_type, salary: '0', installation_rate: '0', warehouse_rate: '0', drivers_license: '', phone: '', address: '' });
export default function PersonnelPage() {
  const { user } = useAuth();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [tab, setTab] = useState<Employment>('staff');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Personnel | null>(null);
  const [form, setForm] = useState(blank('staff'));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const load = async () => { try { setPersonnel(await getPersonnel()); setError(''); } catch (caught) { setError(getErrorMessage(caught)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const showForm = (person?: Personnel) => {
    setEditing(person || null); setFormError('');
    setForm(person ? { full_name: person.full_name, show_in_budgets: person.show_in_budgets !== false, employment_type: person.employment_type || 'staff', salary: String(person.salary ?? 0), installation_rate: String(person.installation_rate ?? 0), warehouse_rate: String(person.warehouse_rate ?? 0), drivers_license: person.drivers_license || '', phone: person.phone || '', address: person.address || '' } : blank(tab));
    setOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || !canAccess(user, 'staff', 2)) return;
    const number = (value: string) => Number(value.replace(',', '.'));
    const salary = number(form.salary), installation_rate = number(form.installation_rate), warehouse_rate = number(form.warehouse_rate);
    if (!form.full_name.trim() || [salary, installation_rate, warehouse_rate].some(value => !Number.isFinite(value) || value < 0)) { setFormError('Укажите ФИО и неотрицательные ставки.'); return; }
    setBusy(true); setFormError('');
    try {
      const data = { ...form, full_name: form.full_name.trim(), salary, installation_rate, warehouse_rate };
      if (editing) await updatePersonnel(editing.id, data); else await createPersonnel(data);
      setTab(form.employment_type); await load(); setOpen(false);
    } catch (caught) { setFormError(getErrorMessage(caught)); } finally { setBusy(false); }
  };
  const remove = async (person: Personnel) => {
    if (busy || !canAccess(user, 'staff', 3) || !window.confirm(`Удалить сотрудника «${person.full_name}»?`)) return;
    setBusy(true); try { await deletePersonnel(person.id); await load(); } catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); }
  };
  const rows = personnel.filter(person => (person.employment_type || 'staff') === tab);
  return <div className="space-y-4">
    <MobileHeaderContent><button type="button" disabled={!canAccess(user, 'staff', 2)} onClick={() => showForm()} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white"><Plus className="h-4 w-4" />Добавить</button></MobileHeaderContent>
    <div role="tablist" aria-label="Тип персонала" className="flex gap-2">{(['staff', 'freelance'] as const).map(type => <button key={type} type="button" role="tab" aria-selected={tab === type} onClick={() => setTab(type)} className={`rounded-xl px-4 py-2 text-sm ${tab === type ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'}`}>{type === 'staff' ? 'Штат' : 'Фриланс'} <span className="ml-1 opacity-70">{personnel.filter(person => (person.employment_type || 'staff') === type).length}</span></button>)}</div>
    {tab === 'freelance' && <p className="text-sm text-gray-500">Сотрудники по договору подряда</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {loading ? <p className="text-gray-400">Загрузка…</p> : <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-gray-800 text-xs text-gray-400"><tr>{['ФИО', 'Оклад, BYN', 'Ставка монтаж, BYN/час', 'Ставка склад, BYN/час', 'Вод. удостоверение', 'Телефон', 'Адрес', 'Отображать в сметах', 'Действия'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map(person => <tr key={person.id} className="border-t border-gray-800 text-gray-300"><td className="px-4 py-3 text-white">{person.full_name}</td><td className="px-4 py-3">{(person.salary ?? 0).toFixed(2)}</td><td className="px-4 py-3">{(person.installation_rate ?? 0).toFixed(2)}</td><td className="px-4 py-3">{(person.warehouse_rate ?? 0).toFixed(2)}</td><td className="px-4 py-3">{person.drivers_license || '—'}</td><td className="px-4 py-3">{person.phone || '—'}</td><td className="px-4 py-3">{person.address || '—'}</td><td className="px-4 py-3">{person.show_in_budgets !== false ? 'Да' : 'Нет'}{person.account_user_id && <span className="block text-xs text-cyan-400">Аккаунт связан</span>}</td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" aria-label={`Редактировать ${person.full_name}`} disabled={busy || !canAccess(user, 'staff', 2)} onClick={() => showForm(person)} className="p-2 text-cyan-400"><Pencil className="h-4 w-4" /></button><button type="button" aria-label={`Удалить ${person.full_name}`} disabled={busy || !canAccess(user, 'staff', 3)} onClick={() => void remove(person)} className="p-2 text-red-400"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}{!rows.length && <tr><td colSpan={9} className="p-8 text-center text-gray-500">Сотрудники не добавлены</td></tr>}</tbody></table></div>
      <div className="divide-y divide-gray-800 md:hidden">{rows.map(person => <div key={person.id} className="space-y-2 p-4"><div className="flex items-center justify-between gap-2"><span className="font-medium text-white">{person.full_name}</span><div className="flex"><button type="button" aria-label={`Редактировать ${person.full_name}`} disabled={busy || !canAccess(user, 'staff', 2)} onClick={() => showForm(person)} className="p-2 text-cyan-400"><Pencil className="h-4 w-4" /></button><button type="button" aria-label={`Удалить ${person.full_name}`} disabled={busy || !canAccess(user, 'staff', 3)} onClick={() => void remove(person)} className="p-2 text-red-400"><Trash2 className="h-4 w-4" /></button></div></div><p className="text-xs text-gray-400">В сметах: {person.show_in_budgets !== false ? 'Да' : 'Нет'}{person.account_user_id ? ' · Аккаунт связан' : ''}</p><p className="text-xs text-gray-400">Оклад: {(person.salary ?? 0).toFixed(2)} BYN</p><p className="text-xs text-gray-300">Монтаж: {(person.installation_rate ?? 0).toFixed(2)} BYN/час · Склад: {(person.warehouse_rate ?? 0).toFixed(2)} BYN/час</p>{person.phone && <p className="text-sm text-cyan-400">{person.phone}</p>}{person.drivers_license && <p className="text-xs text-gray-400">Вод. удостоверение: {person.drivers_license}</p>}{person.address && <p className="text-xs text-gray-500">{person.address}</p>}</div>)}{!rows.length && <p className="p-8 text-center text-gray-500">Сотрудники не добавлены</p>}</div>
    </div>}
    {open && <div role="dialog" aria-modal="true" aria-label={editing ? 'Редактировать сотрудника' : 'Добавить сотрудника'} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"><form onSubmit={save} className="max-h-[90dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-5"><h2 className="text-lg font-semibold text-white">{editing ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</h2><label className="flex items-center gap-3 text-sm text-gray-300"><input type="checkbox" checked={form.show_in_budgets} onChange={event => setForm({ ...form, show_in_budgets: event.target.checked })} className="h-4 w-4 accent-cyan-500" />Отображать в сметах</label><p className="text-xs text-gray-500">Если выключено, сотрудник не предлагается для добавления в сметы и работы мероприятия.</p><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm text-gray-400 sm:col-span-2">ФИО<input autoFocus required value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} className={input} /></label><label className="space-y-1 text-sm text-gray-400">Тип<select value={form.employment_type} onChange={event => setForm({ ...form, employment_type: event.target.value as Employment })} className={input}><option value="staff">Штат</option><option value="freelance">Фриланс — договор подряда</option></select></label>{([['salary', 'Оклад (BYN)'], ['installation_rate', 'Ставка монтаж (BYN/час)'], ['warehouse_rate', 'Ставка склад (BYN/час)']] as const).map(([key, label]) => <label key={key} className="space-y-1 text-sm text-gray-400">{label}<input type="number" inputMode="decimal" min="0" step="0.01" value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} className={input} /></label>)}{([['drivers_license', 'Водительское удостоверение'], ['phone', 'Телефон'], ['address', 'Адрес']] as const).map(([key, label]) => <label key={key} className="space-y-1 text-sm text-gray-400">{label}<input type={key === 'phone' ? 'tel' : 'text'} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} className={input} /></label>)}</div>{formError && <p role="alert" className="text-sm text-red-400">{formError}</p>}<div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-gray-400">Отмена</button><button type="submit" disabled={busy || !canAccess(user, 'staff', 2)} className="rounded-lg bg-cyan-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Сохранение…' : 'Сохранить'}</button></div></form></div>}
  </div>;
}
