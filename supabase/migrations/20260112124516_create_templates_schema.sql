/*
  # Create Templates Schema

  1. New Tables
    - `templates`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users) - владелец шаблона
      - `name` (text) - название шаблона
      - `description` (text) - описание шаблона
      - `created_at` (timestamptz) - дата создания
      - `updated_at` (timestamptz) - дата обновления

    - `template_items`
      - `id` (uuid, primary key)
      - `template_id` (uuid, foreign key to templates) - ссылка на шаблон
      - `equipment_id` (uuid, foreign key to equipment_items) - оборудование
      - `quantity` (integer) - количество единиц
      - `sort_order` (integer) - порядок сортировки элементов
      - `created_at` (timestamptz) - дата создания

  2. Security
    - Enable RLS on both tables
    - Users can only view/edit/delete their own templates
    - Templates and their items are cascaded deleted

  3. Notes
    - Each template contains a list of equipment with quantities
    - Templates can be reused multiple times in different budgets
    - Template items maintain sort order for consistent presentation
*/

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create template_items table
CREATE TABLE IF NOT EXISTS template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);
CREATE INDEX IF NOT EXISTS idx_template_items_template_id ON template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_template_items_equipment_id ON template_items(equipment_id);

-- Enable RLS on templates table
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates"
  ON templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create templates"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable RLS on template_items table
ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view template items of their templates"
  ON template_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_items.template_id
      AND templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items into their templates"
  ON template_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_items.template_id
      AND templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their templates"
  ON template_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_items.template_id
      AND templates.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_items.template_id
      AND templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items from their templates"
  ON template_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_items.template_id
      AND templates.user_id = auth.uid()
    )
  );
