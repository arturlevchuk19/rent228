/*
  # Create Categories Table

  1. New Tables
    - `categories`
      - `id` (uuid, primary key)
      - `name` (text, unique) - название категории
      - `description` (text, nullable) - описание категории
      - `created_at` (timestamptz) - дата создания
      - `updated_at` (timestamptz) - дата обновления

  2. Security
    - Enable RLS on `categories` table
    - Add policies for authenticated users to read categories
    - Add policies for authenticated users to manage categories

  3. Initial Data
    - Insert predefined categories:
      - Свет
      - Звук
      - Видео
      - Электроснабжение
      - Спецэффекты
      - Работы
      - Оборудование для выездной регистрации и вечерней церемонии
*/

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policies for categories
CREATE POLICY "Authenticated users can read categories"
  ON categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert categories"
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
  ON categories
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete categories"
  ON categories
  FOR DELETE
  TO authenticated
  USING (true);

-- Insert initial categories
INSERT INTO categories (name, description) VALUES
  ('Свет', 'Световое оборудование'),
  ('Звук', 'Звуковое оборудование'),
  ('Видео', 'Видеооборудование'),
  ('Электроснабжение', 'Оборудование для электроснабжения'),
  ('Спецэффекты', 'Оборудование для спецэффектов'),
  ('Работы', 'Различные виды работ'),
  ('Оборудование для выездной регистрации и вечерней церемонии', 'Оборудование для выездных мероприятий')
ON CONFLICT (name) DO NOTHING;
