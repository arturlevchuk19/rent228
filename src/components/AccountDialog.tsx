import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserRound, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/authContext';
import { getRoles } from '../lib/account';
import { canAccess, ROLE_NAMES, type RoleDefinition } from '../lib/roles';
import { getErrorMessage } from '../lib/errors';
import { AccountProfile } from './AccountProfile';
import { AccountUsers } from './AccountUsers';
import { AccountRoles } from './AccountRoles';

type AccountTab = 'profile' | 'users' | 'roles';
export function AccountDialog({ onClose, initialTab = 'profile' }: { onClose: () => void; initialTab?: AccountTab }) {
  const { user } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [tab, setTab] = useState<AccountTab>(initialTab);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [rolesError, setRolesError] = useState('');
  const reloadRoles = async () => { const definitions = await getRoles(); setRoles(definitions); setRolesError(''); };
  useEffect(() => {
    let active = true;
    getRoles().then(rows => { if (active) setRoles(rows); }).catch(caught => { if (active) setRolesError(getErrorMessage(caught)); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    const close = () => closeRef.current();
    element?.addEventListener('close', close);
    return () => { element?.removeEventListener('close', close); element?.close(); previous?.focus(); };
  }, []);
  useEffect(() => { if ((tab === 'users' && !canAccess(user, 'users')) || (tab === 'roles' && !canAccess(user, 'roles'))) setTab('profile'); }, [tab, user]);
  if (!user) return null;
  const tabs = [
    { key: 'profile' as const, label: 'Профиль', icon: UserRound },
    ...(canAccess(user, 'users') ? [{ key: 'users' as const, label: 'Пользователи', icon: Users }] : []),
    ...(canAccess(user, 'roles') ? [{ key: 'roles' as const, label: 'Роли и доступ', icon: ShieldCheck }] : []),
  ];
  return createPortal(<dialog ref={dialog} aria-labelledby="account-title" onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto h-[90dvh] max-h-[90dvh] w-[calc(100%-1rem)] max-w-6xl overflow-hidden rounded-xl border border-gray-700 bg-gray-900 p-0 text-gray-200 shadow-2xl backdrop:bg-black/75 sm:w-[calc(100%-3rem)]">
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-800 px-4 py-4 sm:px-6"><div className="min-w-0"><h2 id="account-title" className="text-lg font-semibold text-white sm:text-xl">Личный кабинет</h2><p className="mt-1 text-xs text-gray-400">{user.role_name || ROLE_NAMES[user.role]}</p></div><button type="button" onClick={onClose} aria-label="Закрыть личный кабинет" className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"><X className="h-5 w-5" /></button></header>
      <nav aria-label="Личный кабинет" className="flex shrink-0 gap-1 border-b border-gray-800 p-2 sm:px-5">{tabs.map(item => <button key={item.key} type="button" aria-current={tab === item.key ? 'page' : undefined} onClick={() => setTab(item.key)} className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 py-3 text-xs font-medium sm:flex-none sm:px-4 sm:text-sm ${tab === item.key ? 'bg-cyan-900/30 text-cyan-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><item.icon className="hidden h-4 w-4 sm:block" />{item.label}</button>)}</nav>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
        {rolesError && <p role="alert" className="mb-4 rounded-lg border border-amber-900 bg-amber-900/20 p-3 text-sm text-amber-300">{rolesError}<button type="button" onClick={() => { void reloadRoles().catch(caught => setRolesError(getErrorMessage(caught))); }} className="ml-2 underline">Повторить</button></p>}
        {tab === 'profile' && <AccountProfile />}
        {tab === 'users' && canAccess(user, 'users') && <AccountUsers roles={roles} />}
        {tab === 'roles' && canAccess(user, 'roles') && <AccountRoles roles={roles} reload={reloadRoles} />}
      </div>
    </div>
  </dialog>, document.body);
}
