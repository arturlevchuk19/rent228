import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const rank: Record<string, number> = { superuser: 100, admin: 80, foreman: 60, clerk: 40, staff: 20, warehouse: 10 };
const columns = 'id,email,full_name,role,status,created_at';
const passwordValid = (value: unknown): value is string => typeof value === 'string' && value.length >= 8 && /[A-ZА-ЯЁ]/u.test(value) && /\d/.test(value);
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return response({ error: 'Метод не поддерживается' }, 405);
  try {
    const authorization = request.headers.get('Authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return response({ error: 'Войдите в аккаунт' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: identity, error: identityError } = await admin.auth.getUser(token);
    if (identityError || !identity.user) return response({ error: 'Сессия истекла. Войдите заново.' }, 401);
    const { data: actor, error: actorError } = await admin.from('users').select(columns).eq('id', identity.user.id).single();
    if (actorError || actor?.status !== 'active') return response({ error: 'Аккаунт не активен' }, 403);
    const { data: definition, error: roleError } = await admin.from('app_roles').select('permissions').eq('key', actor.role).single();
    if (roleError) return response({ error: 'Выполните миграцию личного кабинета в Supabase.' }, 503);
    const allowed = (level: number) => actor.role === 'superuser' || Number(definition?.permissions?.users || 0) >= level;
    const canManageRole = async (key: string) => {
      if (!Object.hasOwn(rank, key) || rank[key] >= rank[actor.role]) return false;
      if (actor.role === 'superuser') return true;
      const { data: targetRole, error } = await admin.from('app_roles').select('permissions').eq('key', key).single();
      if (error || !targetRole) return false;
      return Object.entries(targetRole.permissions).every(([module, level]) => Number(level) <= Number(definition.permissions[module] || 0));
    };
    const body = await request.json();
    if (body.action === 'list') {
      if (!allowed(1)) return response({ error: 'Недостаточно прав для просмотра пользователей' }, 403);
      const { data, error } = await admin.from('users').select(columns).order('created_at');
      if (error) throw error;
      return response(data);
    }
    if (!allowed(2)) return response({ error: 'Недостаточно прав для управления пользователями' }, 403);
    if (body.action === 'create') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 120 || !passwordValid(body.password)) return response({ error: 'Проверьте e-mail, имя и пароль. Пароль: минимум 8 символов, заглавная буква и цифра.' }, 400);
      if (typeof body.role !== 'string' || !(await canManageRole(body.role))) return response({ error: 'Можно назначить только роль ниже своей' }, 403);
      const { data, error } = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { full_name: name } });
      if (error || !data.user) return response({ error: error?.message || 'Не удалось создать аккаунт' }, 400);
      const { data: profile, error: profileError } = await admin.from('users').upsert({ id: data.user.id, email, full_name: name, role: body.role, status: 'active' }).select(columns).single();
      if (profileError) { await admin.auth.admin.deleteUser(data.user.id); throw profileError; }
      return response(profile);
    }
    if (typeof body.id !== 'string' || body.id === actor.id) return response({ error: 'Свою роль и статус нельзя менять через список пользователей' }, 403);
    const { data: target, error: targetError } = await admin.from('users').select(columns).eq('id', body.id).single();
    if (targetError || !target) return response({ error: 'Пользователь не найден' }, 404);
    if (!(await canManageRole(target.role))) return response({ error: 'Можно управлять только пользователями с ролью ниже своей' }, 403);
    if (body.action === 'password') {
      if (!passwordValid(body.password)) return response({ error: 'Минимум 8 символов, заглавная буква и цифра.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(target.id, { password: body.password });
      if (error) throw error;
      return response({ ok: true });
    }
    if (body.action === 'update') {
      if (typeof body.role !== 'string' || !(await canManageRole(body.role)) || !['active', 'inactive', 'pending'].includes(body.status)) return response({ error: 'Недопустимая роль или статус' }, 400);
      const { data, error } = await admin.from('users').update({ role: body.role, status: body.status }).eq('id', target.id).eq('role', target.role).select(columns).single();
      if (error) throw error;
      return response(data);
    }
    return response({ error: 'Неизвестное действие' }, 400);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Не удалось выполнить действие' }, 400);
  }
});
