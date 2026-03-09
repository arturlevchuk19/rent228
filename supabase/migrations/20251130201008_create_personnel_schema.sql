/*
  # Create Personnel Schema

  1. New Tables
    - `personnel`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `full_name` (text) - ФИО
      - `salary` (decimal) - Оклад
      - `rate_percentage` (decimal) - % ставка
      - `drivers_license` (text) - Водительское удостоверение
      - `phone` (text) - Телефон
      - `address` (text) - Адрес
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `personnel` table
    - Add policies for authenticated users to manage personnel
*/

CREATE TABLE IF NOT EXISTS personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  full_name text NOT NULL,
  salary decimal(10, 2) DEFAULT 0,
  rate_percentage decimal(5, 2) DEFAULT 100,
  drivers_license text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personnel"
  ON personnel FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personnel"
  ON personnel FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personnel"
  ON personnel FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own personnel"
  ON personnel FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_personnel_user_id ON personnel(user_id);
