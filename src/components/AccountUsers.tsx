import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/authContext';
import { listAccountUsers, createAccountUser, updateAccountUser, deleteAccountUser, resetAccountPassword } from '../lib/account';
import { ROLE_NAMES, ROLE_ORDER, ROLE_RANK, canAccess, canManageUser, defaultPermissions, passwordError, type RoleDefinition } from '../lib/roles';
import type { User, UserRole } from '../lib/supabase';
import { getErrorMessage } from '../lib/errors';
import { PasswordField, accountInput, accountButton } from './PasswordField';

export function AccountUsers({ roles }: { roles: RoleDefinition[] }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [passwordTarget, setPasswordTarget] = useState<string | null>(null);
  const [replacementPassword, setReplacementPassword] = useState('');
  const reload = async () => { const rows = await listAccountUsers(); setUsers(rows); };
  useEffect(() => {
    let active = true;
    listAccountUsers().then(rows => { if (active) setUsers(rows); }).catch(caught => { if (active) setError(getErrorMessage(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (!user) return null;
  const assignable = ROLE_ORDER.filter(key => ROLE_RANK[key] < ROLE_RANK[user.role] && (user.role === 'superuser' || Object.entries(roles.find(item => item.key === key)?.permissions || defaultPermissions(key)).every(([module, level]) => level <= (user.permissions || defaultPermissions(user.role))[module as keyof ReturnType<typeof defaultPermissions>])));
  const selectedRole = assignable.includes(role) ? role : (assignable[0] || 'staff');
  const roleName = (key: UserRole) => roles.find(item => item.key === key)?.name || ROLE_NAMES[key];
  const perform = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await action(); await reload(); setMessage(success); }
    catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); }
  };
  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">{error}<button type="button" disabled={busy} onClick={() => { void perform(reload, 'Список обновлён.'); }} className="ml-2 underline">Повторить</button></p>}
    {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
    {canAccess(user, 'users', 2) && <form className="grid items-end gap-3 rounded-xl border border-gray-800 bg-gray-800/30 p-4 sm:grid-cols-2 xl:grid-cols-5" onSubmit={event => {
      event.preventDefault();
      const invalid = passwordError(password); if (invalid) { setError(invalid); return; }
      void perform(async () => { await createAccountUser(email.trim(), password, name.trim(), selectedRole); setEmail(''); setPassword(''); setName(''); }, 'Пользователь создан.');
    }}>
      <label className="space-y-2 text-sm text-gray-300"><span>Логин (e-mail)</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} required className={accountInput} /></label>
      <PasswordField label="Пароль" value={password} onChange={setPassword} disabled={busy} />
      <label className="space-y-2 text-sm text-gray-300"><span>Имя</span><input value={name} onChange={event => setName(event.target.value)} maxLength={120} disabled={busy} required className={accountInput} /></label>
      <label className="space-y-2 text-sm text-gray-300"><span>Роль</span><select value={selectedRole} onChange={event => setRole(event.target.value as UserRole)} disabled={busy} className={accountInput}>{assignable.map(key => <option key={key} value={key}>{roleName(key)}</option>)}</select></label>
      <button disabled={busy || !assignable.length} className={accountButton}>{busy ? 'Подождите...' : 'Создать'}</button>
    </form>}
    {loading ? <p role="status" className="py-10 text-center text-gray-400">Загрузка пользователей...</p> : <div className="space-y-3">{users.map(target => {
      const editable = canManageUser(user, target) && assignable.includes(target.role);
      const statuses = { active: 'Активен', inactive: 'Отключён', pending: 'Ожидает активации' };
      return <div key={target.id} className="rounded-xl border border-gray-800 bg-gray-800/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1"><p className="break-words font-medium text-white">{target.full_name}{target.id === user.id && <span className="ml-2 text-xs text-cyan-400">Вы</span>}</p><p className="mt-1 break-all text-sm text-gray-400">{target.email}</p><span className={`mt-2 inline-block rounded px-2 py-1 text-xs ${target.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>{statuses[target.status]}</span></div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <select aria-label={`Роль: ${target.full_name}`} value={target.role} disabled={!editable || busy} onChange={event => { void perform(() => updateAccountUser(target.id, event.target.value as UserRole, target.status), 'Роль изменена.'); }} className={`${accountInput} w-full sm:w-48`}>
              {!assignable.includes(target.role) && <option value={target.role}>{roleName(target.role)}</option>}{assignable.map(key => <option key={key} value={key}>{roleName(key)}</option>)}
            </select>
            {editable && <>
              <button type="button" disabled={busy} onClick={() => { void perform(() => updateAccountUser(target.id, target.role, target.status === 'active' ? 'inactive' : 'active'), 'Статус изменён.'); }} className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-50">{target.status === 'active' ? 'Отключить' : 'Активировать'}</button>
              <button type="button" disabled={busy} onClick={() => { setPasswordTarget(passwordTarget === target.id ? null : target.id); setReplacementPassword(''); }} className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-50">Сменить пароль</button>
              {canAccess(user, 'users', 3) && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Удалить пользователя «${target.full_name}»?`)) void perform(() => deleteAccountUser(target.id), 'Пользователь удалён.'); }} className="rounded-lg border border-red-900 px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-50">Удалить</button>}
            </>}
          </div>
        </div>
        {editable && passwordTarget === target.id && <form className="mt-4 flex flex-col items-end gap-3 border-t border-gray-800 pt-4 sm:flex-row" onSubmit={event => {
          event.preventDefault(); const invalid = passwordError(replacementPassword); if (invalid) { setError(invalid); return; }
          void perform(async () => { await resetAccountPassword(target.id, replacementPassword); setPasswordTarget(null); setReplacementPassword(''); }, 'Пароль пользователя изменён.');
        }}><div className="w-full flex-1"><PasswordField label="Новый пароль" value={replacementPassword} onChange={setReplacementPassword} disabled={busy} /></div><button disabled={busy} className={accountButton}>Сохранить пароль</button></form>}
      </div>;
    })}{!users.length && !error && <p className="text-sm text-gray-400">Пользователи не найдены.</p>}</div>}
  </div>;
}
