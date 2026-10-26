import type { UserRole, UserStatus } from './supabase';

export const MODULES = [
  ['calendar', 'Календарь'], ['events', 'Мероприятия'], ['budgets', 'Сметы'],
  ['specifications', 'Складская спецификация'], ['equipment', 'Оборудование'],
  ['contacts', 'Справочники'], ['templates', 'Шаблоны смет'], ['payments', 'Выплаты'],
  ['personnel-report', 'Отчёт по выплатам'], ['staff', 'Персонал'],
  ['dashboard', 'Главная'], ['logistics', 'Логистика'], ['users', 'Пользователи'],
  ['roles', 'Роли и доступ'], ['settings', 'Настройки'],
] as const;
export type AppModule = typeof MODULES[number][0];
export type AccessLevel = 0 | 1 | 2 | 3;
export type Permissions = Record<AppModule, AccessLevel>;
export const ACCESS_LABELS = ['Нет доступа', 'Просмотр', 'Редактирование', 'Удаление'] as const;
export const ROLE_ORDER: UserRole[] = ['superuser', 'admin', 'foreman', 'clerk', 'staff', 'warehouse'];
export const ROLE_NAMES: Record<UserRole, string> = {
  superuser: 'Владелец', admin: 'Администратор', foreman: 'Старший по площадке',
  clerk: 'Менеджер', staff: 'Техник', warehouse: 'Кладовщик',
};
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  superuser: 'Полный доступ к системе. Права владельца не изменяются.',
  admin: 'Управление работой компании и сотрудниками.',
  foreman: 'Подготовка мероприятий и руководство работами на площадке.',
  clerk: 'Ведение мероприятий, смет и оборудования.',
  staff: 'Просмотр мероприятий и рабочих заданий.',
  warehouse: 'Работа с оборудованием и складскими спецификациями.',
};
export const ROLE_RANK: Record<UserRole, number> = { superuser: 100, admin: 80, foreman: 60, clerk: 40, staff: 20, warehouse: 10 };
export function defaultPermissions(role: UserRole): Permissions {
  const permissions = Object.fromEntries(MODULES.map(([key]) => [key, 0])) as Permissions;
  if (role === 'superuser' || role === 'admin') {
    for (const [key] of MODULES) permissions[key] = 3;
    return permissions;
  }
  for (const key of ['calendar', 'events', 'equipment', 'dashboard', 'specifications'] as AppModule[]) permissions[key] = 1;
  if (role === 'clerk' || role === 'foreman') {
    for (const key of ['events', 'equipment', 'budgets', 'logistics'] as AppModule[]) permissions[key] = 2;
  }
  if (role === 'foreman' || role === 'warehouse') permissions.specifications = 2;
  return permissions;
}
export interface RoleDefinition { key: UserRole; name: string; permissions: Permissions; updated_at: string; }
export interface PermissionUser { id: string; role: UserRole; status: UserStatus; permissions?: Permissions; role_name?: string; }
export function canAccess(user: PermissionUser | null, module: AppModule, level: AccessLevel = 1): boolean {
  if (!user || user.status !== 'active') return false;
  if (user.role === 'superuser') return true;
  return (user.permissions ?? defaultPermissions(user.role))[module] >= level;
}
export function canManageUser(actor: PermissionUser | null, target: { id: string; role: UserRole }): boolean {
  return !!actor && actor.id !== target.id && canAccess(actor, 'users', 2) && ROLE_RANK[actor.role] > ROLE_RANK[target.role];
}
export function passwordError(password: string): string | null {
  return password.length >= 8 && /[A-ZА-ЯЁ]/u.test(password) && /\d/.test(password)
    ? null : 'Минимум 8 символов, одна заглавная буква и одна цифра.';
}
