/*
  # Исправление политики RLS для регистрации пользователей

  ## Проблема
  При регистрации нового пользователя возникает ошибка:
  "new row violates row-level security policy for table users"
  
  Это происходит потому, что у нас нет политики, разрешающей INSERT для новых пользователей.

  ## Решение
  Добавляем политику, которая позволяет аутентифицированным пользователям создавать 
  свою собственную запись в таблице users (когда auth.uid() совпадает с id).

  ## Изменения
  1. Удаляем старые политики INSERT (если есть)
  2. Добавляем новую политику "Users can create own profile" для INSERT
  3. Политика разрешает создание записи только если:
     - Пользователь аутентифицирован
     - ID создаваемой записи совпадает с auth.uid()
*/

-- Удаляем старые политики INSERT для users, если они есть
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can create own profile" ON users;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Создаём политику для регистрации новых пользователей
CREATE POLICY "Users can create own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Также добавим политику для обновления своего профиля
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can update own profile" ON users;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
