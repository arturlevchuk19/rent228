import { createClient } from '@supabase/supabase-js';
import { supabase, type User, type UserRole, type UserStatus } from './supabase';
import { passwordError, type RoleDefinition } from './roles';

export async function getRoles(): Promise<RoleDefinition[]> {
  const { data, error } = await supabase.from('app_roles').select('key, name, permissions, updated_at');
  if (error) throw new Error('Настройки ролей ещё не подключены. Выполните миграцию личного кабинета в Supabase.');
  return data || [];
}
export async function saveRole(role: RoleDefinition): Promise<void> {
  const { error } = await supabase.rpc('account_save_role', {
    p_key: role.key, p_name: role.name.trim(), p_permissions: role.permissions, p_expected_updated_at: role.updated_at,
  });
  if (error) throw new Error(error.message);
}
export async function saveProfile(fullName: string, email: string, currentEmail: string): Promise<boolean> {
  const { error } = await supabase.rpc('account_update_profile', { p_full_name: fullName.trim() });
  if (error) throw new Error(error.message.includes('account_update_profile') ? 'Выполните миграцию личного кабинета в Supabase.' : error.message);
  if (email.trim().toLowerCase() !== currentEmail.toLowerCase()) {
    const { error: emailError } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
    if (emailError) throw emailError;
    return true;
  }
  return false;
}
export async function changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  const invalid = passwordError(newPassword);
  if (invalid) throw new Error(invalid);
  // A separate in-memory client verifies the password without replacing the working session.
  const verifier = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'password-verification' },
  });
  try {
    const { data, error } = await verifier.auth.signInWithPassword({ email, password: currentPassword });
    if (error || !data.user) throw new Error('Текущий пароль указан неверно.');
    const { data: identity, error: identityError } = await supabase.auth.getUser();
    if (identityError || identity.user?.id !== data.user.id) throw new Error('Не удалось подтвердить пользователя. Войдите заново.');
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;
  } finally {
    await verifier.auth.signOut({ scope: 'local' });
  }
}
async function adminAction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('account-admin', { body });
  if (error) {
    if ('context' in error && error.context instanceof Response) {
      const details = await error.context.json().catch(() => null);
      if (details?.error) throw new Error(details.error);
    }
    throw new Error('Не удалось выполнить действие. Проверьте подключение функции account-admin в Supabase.');
  }
  return data as T;
}
export const listAccountUsers = () => adminAction<User[]>({ action: 'list' });
export const createAccountUser = (email: string, password: string, fullName: string, role: UserRole) => adminAction<User>({ action: 'create', email, password, full_name: fullName, role });
export const updateAccountUser = (id: string, role: UserRole, status: UserStatus) => adminAction<User>({ action: 'update', id, role, status });
export const resetAccountPassword = (id: string, password: string) => adminAction<void>({ action: 'password', id, password });
export async function deleteAccountUser(id: string): Promise<void> {
  const { error } = await supabase.rpc('account_delete_user', { p_target: id });
  if (error) throw new Error(error.code === '23503' ? 'У пользователя есть связанные документы. Отключите его вместо удаления.' : error.message);
}
