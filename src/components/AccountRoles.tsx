import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/authContext';
import { saveRole } from '../lib/account';
import { ACCESS_LABELS, MODULES, ROLE_ORDER, ROLE_RANK, ROLE_DESCRIPTIONS, canAccess, type RoleDefinition, type AccessLevel } from '../lib/roles';
import type { UserRole } from '../lib/supabase';
import { getErrorMessage } from '../lib/errors';
import { accountInput } from './PasswordField';

export function AccountRoles({ roles, reload }: { roles: RoleDefinition[]; reload: () => Promise<void> }) {
  const { user, refreshUser } = useAuth();
  const [selected, setSelected] = useState<UserRole>(user?.role || 'staff');
  const [draft, setDraft] = useState<RoleDefinition | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { setDraft(roles.find(role => role.key === selected) || null); setError(''); setMessage(''); }, [selected, roles]);
  if (!user) return null;
  const editable = selected !== 'superuser' && canAccess(user, 'roles', 2) && ROLE_RANK[user.role] > ROLE_RANK[selected];
  const persist = async (next: RoleDefinition) => {
    if (!editable || busy) return;
    if (next.name.trim().length < 2) { setError('Название роли должно содержать минимум 2 символа.'); return; }
    setDraft(next); setBusy(true); setError(''); setMessage('');
    try { await saveRole(next); await reload(); await refreshUser(); setMessage('Изменения сохранены.'); }
    catch (caught) { setError(getErrorMessage(caught)); setDraft(roles.find(role => role.key === selected) || null); }
    finally { setBusy(false); }
  };
  return <div className="grid gap-5 md:grid-cols-[230px_minmax(0,1fr)]">
    <nav aria-label="Роли" className="grid grid-cols-2 gap-2 md:flex md:flex-col">{ROLE_ORDER.map(key => {
      const role = roles.find(item => item.key === key); if (!role) return null;
      return <button key={key} type="button" disabled={busy} onClick={() => setSelected(key)} className={`rounded-xl border p-3 text-left text-sm transition-colors disabled:opacity-50 ${selected === key ? 'border-cyan-700 bg-cyan-900/20 text-cyan-300' : 'border-gray-800 bg-gray-800/20 text-gray-300 hover:bg-gray-800'}`}><span className="flex items-center gap-2 font-medium">{key === 'superuser' && <ShieldCheck className="h-4 w-4 shrink-0" />}{role.name}</span><span className="mt-1 hidden text-xs leading-relaxed text-gray-500 md:block">{ROLE_DESCRIPTIONS[key]}</span></button>;
    })}</nav>
    <section className="min-w-0 space-y-4">
      {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
      {!draft ? <p className="text-sm text-gray-400">Не удалось загрузить настройки роли.</p> : <>
        <p className="text-xs text-gray-400">{selected === 'superuser' ? 'Владелец имеет полный доступ. Его права защищены от изменения.' : editable ? 'Изменения сохраняются автоматически.' : 'Действующие права роли. Изменять можно только роли ниже своей.'}</p>
        <label className="block space-y-2 text-sm text-gray-300"><span>Название роли</span><input value={draft.name} disabled={!editable || busy} maxLength={80} onChange={event => setDraft({ ...draft, name: event.target.value })} onBlur={() => { if (draft.name !== roles.find(role => role.key === selected)?.name) void persist(draft); }} className={accountInput} /></label>
        <h3 className="font-semibold text-white">Разделы и доступ</h3>
        <p className="text-xs text-gray-500">Редактирование включает просмотр и добавление. Удаление включает все предыдущие права.</p>
        <div className="space-y-2">{MODULES.map(([module, label]) => {
          const maxLevel = user.role === 'superuser' ? 3 : (user.permissions?.[module] || 0);
          return <fieldset key={module} disabled={!editable || busy} className="rounded-lg border border-gray-800 p-3"><legend className="px-1 text-sm text-gray-200">{label}</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{ACCESS_LABELS.map((accessLabel, index) => <label key={index} className={`flex items-center gap-2 text-xs ${editable && index <= maxLevel ? 'cursor-pointer text-gray-300' : 'text-gray-500'}`}><input type="radio" name={`access-${module}`} checked={draft.permissions[module] === index} disabled={index > maxLevel} onChange={() => { void persist({ ...draft, permissions: { ...draft.permissions, [module]: index as AccessLevel } }); }} className="h-4 w-4 accent-cyan-500" />{accessLabel}</label>)}</div></fieldset>;
        })}</div>
        {busy && <p role="status" className="text-xs text-cyan-400">Сохранение...</p>}
      </>}
    </section>
  </div>;
}
