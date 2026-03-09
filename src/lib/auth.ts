import { supabase, UserRole, User } from './supabase';

export interface AuthUser extends User {
  role: UserRole;
}

const roleHierarchy: UserRole[] = ['warehouse', 'staff', 'clerk', 'admin', 'superuser'];

export function hasAccess(user: AuthUser | null, requiredRole: UserRole): boolean {
  if (!user) return false;

  const userRoleIndex = roleHierarchy.indexOf(user.role);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

  return userRoleIndex >= requiredRoleIndex;
}

export function isWarehouse(user: AuthUser | null): boolean {
  return user?.role === 'warehouse';
}

export function canViewField(user: AuthUser | null, field: string): boolean {
  if (!user) return false;

  if (user.role === 'superuser') return true;

  const adminFields = ['category', 'type', 'subtype', 'article', 'price_usd'];
  const clerkFields = ['category', 'type', 'subtype', 'article'];

  if (user.role === 'admin') {
    return adminFields.includes(field);
  }

  if (user.role === 'clerk') {
    return clerkFields.includes(field);
  }

  return false;
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    throw new Error('User already registered');
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('User creation failed');

  const { error: userError } = await supabase.from('users').insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    role: 'staff',
    status: 'pending',
  });

  if (userError) {
    await supabase.auth.admin.deleteUser(authData.user.id).catch(() => {});
    throw userError;
  }

  return authData;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (userError) throw userError;

  if (!userData) {
    throw new Error('User profile not found. Please contact administrator.');
  }

  if (userData.status !== 'active') {
    throw new Error('Account is pending approval');
  }

  return { ...data, user: userData as AuthUser };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !userData) return null;

  return userData as AuthUser;
}

export async function updateUserRole(userId: string, role: UserRole, status: string) {
  const { error } = await supabase
    .from('users')
    .update({ role, status })
    .eq('id', userId);

  if (error) throw error;
}
