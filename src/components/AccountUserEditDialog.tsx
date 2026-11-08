import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { User, UserRole, UserStatus } from '../lib/supabase';
import type { AccountPersonnelChoice } from '../lib/account';
import { getErrorMessage } from '../lib/errors';
import { accountButton, accountInput } from './PasswordField';

export interface AccountUserEditValues { fullName: string; role: UserRole; status: UserStatus; personnelId: string | null; }
export function AccountUserEditDialog({ target, personnel, roles, roleName, onSave, onClose }: {
  target: User; personnel: AccountPersonnelChoice[]; roles: UserRole[]; roleName: (role: UserRole) => string;
  onSave: (values: AccountUserEditValues) => Promise<void>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(target.full_name);
  const [role, setRole] = useState(target.role);
  const [status, setStatus] = useState(target.status);
  const [personnelId, setPersonnelId] = useState(personnel.find(person => person.account_user_id === target.id)?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const node = dialog.current; const previous = document.activeElement as HTMLElement | null; node?.showModal(); return () => { node?.close(); previous?.focus(); }; }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    if (!name.trim()) { setError('Укажите имя пользователя.'); return; }
    setBusy(true); setError('');
    try { await onSave({ fullName: name.trim(), role, status, personnelId: personnelId || null }); }
    catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(false); }
  };
  return createPortal(<dialog ref={dialog} aria-labelledby="account-user-edit-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-lg overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-5 text-gray-200 backdrop:bg-black/70">
    <header className="mb-5 flex items-center justify-between gap-3"><h2 id="account-user-edit-title" className="text-lg font-semibold">Редактировать пользователя</h2><button type="button" aria-label="Закрыть редактирование пользователя" disabled={busy} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800"><X className="h-5 w-5" /></button></header>
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1"><p className="text-xs text-gray-400">Логин (e-mail)</p><p className="break-all text-sm">{target.email}</p></div>
      <label className="block space-y-2 text-sm"><span>Имя</span><input autoFocus required maxLength={120} value={name} onChange={event => setName(event.target.value)} disabled={busy} className={accountInput} /></label>
      <label className="block space-y-2 text-sm"><span>Роль</span><select value={role} onChange={event => setRole(event.target.value as UserRole)} disabled={busy} className={accountInput}>{roles.map(key => <option key={key} value={key}>{roleName(key)}</option>)}</select></label>
      <label className="block space-y-2 text-sm"><span>Статус</span><select value={status} onChange={event => setStatus(event.target.value as UserStatus)} disabled={busy} className={accountInput}><option value="active">Активен</option><option value="inactive">Отключён</option><option value="pending">Ожидает активации</option></select></label>
      <label className="block space-y-2 text-sm"><span>Сотрудник из персонала</span><select aria-label="Связанный сотрудник" value={personnelId} onChange={event => setPersonnelId(event.target.value)} disabled={busy} className={accountInput}><option value="">Без связи с персоналом</option>{personnel.filter(person => !person.account_user_id || person.account_user_id === target.id).map(person => <option key={person.id} value={person.id}>{person.full_name} — {person.employment_type === 'freelance' ? 'Фриланс' : 'Штат'}</option>)}</select></label>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">Отмена</button><button type="submit" disabled={busy} className={accountButton}>{busy ? 'Сохранение…' : 'Сохранить'}</button></div>
    </form>
  </dialog>, document.body);
}
