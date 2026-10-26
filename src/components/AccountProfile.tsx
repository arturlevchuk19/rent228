import { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/authContext';
import { saveProfile, changePassword } from '../lib/account';
import { signOut } from '../lib/auth';
import { ROLE_NAMES, passwordError } from '../lib/roles';
import { getErrorMessage } from '../lib/errors';
import { PasswordField, accountInput, accountButton } from './PasswordField';

export function AccountProfile() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  if (!user) return null;
  const begin = () => { setBusy(true); setError(''); setMessage(''); };
  return <div className="space-y-6">
    <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 sm:p-5">
      <p className="mb-1 text-xs text-gray-400">ID пользователя</p><p className="break-all font-mono text-xs text-cyan-400 sm:text-sm">{user.id}</p>
      <p className="mt-3 flex items-center gap-2 text-sm text-gray-300"><ShieldCheck className="h-4 w-4 text-cyan-500" />{user.role_name || ROLE_NAMES[user.role]}</p>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-900/20 p-3 text-sm text-emerald-300">{message}</p>}
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      if (!name.trim()) { setError('Укажите имя.'); return; }
      begin();
      try {
        const confirmation = await saveProfile(name, email, user.email);
        await refreshUser();
        setMessage(confirmation ? 'Имя сохранено. Подтвердите новый e-mail по ссылке из письма.' : 'Профиль сохранён.');
      } catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); }
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-gray-300"><span>Логин</span><input readOnly value={user.email} className={`${accountInput} text-gray-400`} /></label>
        <label className="space-y-2 text-sm text-gray-300"><span>Имя</span><input value={name} onChange={event => setName(event.target.value)} maxLength={120} autoComplete="name" disabled={busy} required className={accountInput} /></label>
      </div>
      <label className="block space-y-2 text-sm text-gray-300"><span>E-mail</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" disabled={busy} required className={accountInput} /><span className="block text-xs text-gray-500">Используется для входа. Изменение адреса подтверждается по электронной почте.</span></label>
      <div className="flex justify-end"><button disabled={busy} className={accountButton}>{busy ? 'Сохранение...' : 'Сохранить профиль'}</button></div>
    </form>
    <form className="space-y-4 border-t border-gray-800 pt-6" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const invalid = passwordError(newPassword);
      if (invalid || newPassword !== repeatPassword) { setError(invalid || 'Новые пароли не совпадают.'); setMessage(''); return; }
      begin();
      try { await changePassword(user.email, currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setRepeatPassword(''); setMessage('Пароль изменён.'); }
      catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); }
    }}>
      <h3 className="font-semibold text-white">Смена пароля</h3>
      <div className="grid gap-4 md:grid-cols-3"><PasswordField label="Текущий пароль" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" disabled={busy} /><PasswordField label="Новый пароль" value={newPassword} onChange={setNewPassword} disabled={busy} /><PasswordField label="Ещё раз" value={repeatPassword} onChange={setRepeatPassword} disabled={busy} /></div>
      <p className="text-xs text-gray-500">Минимум 8 символов, одна заглавная буква и одна цифра.</p>
      <div className="flex justify-end"><button disabled={busy} className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50">Сменить пароль</button></div>
    </form>
    <button type="button" disabled={busy} onClick={async () => { begin(); try { await signOut(); } catch (caught) { setError(getErrorMessage(caught)); setBusy(false); } }} className="flex w-full items-center gap-3 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-left text-sm font-medium text-red-300 hover:bg-red-900/50 disabled:opacity-50"><LogOut className="h-4 w-4" />Выйти из аккаунта</button>
  </div>;
}
