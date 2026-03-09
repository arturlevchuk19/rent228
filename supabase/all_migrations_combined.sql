/*
  # RentMaster Core Schema - Initial Setup

  ## Overview
  Creates the foundational database structure for the RentMaster equipment rental management system.

  ## New Tables
  
  ### 1. users
  Extended user profile with role-based access control
  - `id` (uuid, PK) - Links to auth.users
  - `email` (text) - User email
  - `full_name` (text) - Display name
  - `role` (text) - One of: superuser, admin, clerk, staff
  - `status` (text) - Account status
  - `created_at` (timestamptz) - Registration date

  ### 2. equipment
  Master catalog of equipment items available for rent
  - `id` (uuid, PK) 
  - `category` (text) - Equipment category
  - `type` (text) - Equipment type
  - `subtype` (text) - Equipment subtype
  - `article` (text) - Article/SKU number
  - `price_usd` (numeric) - Rental price in USD
  - `power_consumption` (numeric) - Power consumption in watts
  - `weight` (numeric) - Weight in kg
  - `cost_price` (numeric) - Purchase/replacement cost
  - `available_for_rent` (boolean) - Active status
  - `description` (text) - Additional notes

  ### 3. inventory_units
  Individual equipment units with RFID tracking
  - `id` (uuid, PK)
  - `equipment_id` (uuid, FK) - References equipment
  - `rfid_tag` (text) - RFID identifier
  - `serial_number` (text) - Manufacturer serial
  - `status` (text) - In Stock, Reserved, Rented, Maintenance, Retired
  - `last_maintenance` (date) - Last maintenance date
  - `notes` (text) - Unit-specific notes

  ### 4. clients
  Customer database
  - `id` (uuid, PK)
  - `name` (text) - Client name
  - `contact_person` (text) - Contact name
  - `email` (text) - Contact email
  - `phone` (text) - Contact phone
  - `notes` (text) - Additional info

  ### 5. venues
  Event locations database
  - `id` (uuid, PK)
  - `name` (text) - Venue name
  - `address` (text) - Full address
  - `city` (text) - City
  - `distance_km` (numeric) - Distance from warehouse
  - `notes` (text) - Access info, parking, etc.

  ### 6. cars
  Transport fleet for delivery calculations
  - `id` (uuid, PK)
  - `brand` (text) - Vehicle brand/model
  - `license_plate` (text) - Registration number
  - `rate_per_km_usd` (numeric) - Cost per km
  - `status` (text) - Active, Maintenance, Retired

  ### 7. staff
  Personnel database for work distribution
  - `id` (uuid, PK)
  - `user_id` (uuid, FK) - Links to users
  - `employment_type` (text) - Salary, Contract, Helper
  - `monthly_salary_byn` (numeric) - Monthly salary (for Salary type)
  - `primary_role` (text) - Main job function
  - `rate_per_km_byn` (numeric) - For drivers

  ### 8. events
  Event/project management
  - `id` (uuid, PK)
  - `name` (text) - Event name
  - `client_id` (uuid, FK) - References clients
  - `venue_id` (uuid, FK) - References venues
  - `event_date` (date) - Event date
  - `load_in_date` (date) - Equipment delivery date
  - `load_out_date` (date) - Equipment pickup date
  - `status` (text) - Planning, Confirmed, In Progress, Completed, Cancelled

  ### 9. estimates
  Quotations with versioning support
  - `id` (uuid, PK)
  - `estimate_number` (text) - Format: СМ-YYYY-NNN
  - `version` (integer) - Version number
  - `is_active` (boolean) - Only one active version per number
  - `event_id` (uuid, FK) - References events
  - `calculation_type` (text) - Dollars, Cash BYN, Cashless BYN
  - `usd_rate` (numeric) - USD/BYN exchange rate at creation
  - `status` (text) - Draft, Sent, Approved, Rejected
  - `total_usd` (numeric) - Total in USD
  - `total_byn` (numeric) - Total in BYN
  - `created_by` (uuid, FK) - References users
  - `created_at` (timestamptz)

  ### 10. estimate_items
  Line items in estimates
  - `id` (uuid, PK)
  - `estimate_id` (uuid, FK) - References estimates
  - `item_type` (text) - Equipment, Work, Delivery
  - `equipment_id` (uuid, FK) - For Equipment type
  - `work_type` (text) - For Work type
  - `car_id` (uuid, FK) - For Delivery type
  - `quantity` (numeric) - Quantity or hours
  - `days` (numeric) - Rental days
  - `price_usd` (numeric) - Unit price
  - `distance_km` (numeric) - For Delivery
  - `total_usd` (numeric) - Calculated total
  - `total_byn` (numeric) - Calculated total in BYN

  ### 11. work_reports
  Actual work completion tracking
  - `id` (uuid, PK)
  - `event_id` (uuid, FK) - References events
  - `estimate_id` (uuid, FK) - References estimates
  - `report_date` (date) - Date of report
  - `status` (text) - Draft, Submitted, Approved, Paid
  - `notes` (text) - Additional comments

  ### 12. work_distribution
  Payment distribution to staff
  - `id` (uuid, PK)
  - `work_report_id` (uuid, FK) - References work_reports
  - `estimate_item_id` (uuid, FK) - References estimate_items
  - `staff_id` (uuid, FK) - References staff
  - `share_percentage` (numeric) - Share of work (can exceed 100% total)
  - `payment_percentage` (numeric) - Payment coefficient (50%, 70%, 100%)
  - `amount_byn` (numeric) - Calculated payment amount
  - `notes` (text) - Explanation

  ## Security
  - RLS enabled on all tables
  - Policies enforce role-based access control
  - Authenticated users only
  - Superuser has full access
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('superuser', 'admin', 'clerk', 'staff')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

-- 2. Equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  category text NOT NULL,
  type text NOT NULL,
  subtype text,
  article text NOT NULL UNIQUE,
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  power_consumption numeric(10,2),
  weight numeric(10,2),
  cost_price numeric(10,2),
  available_for_rent boolean DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipment viewable by authenticated users"
  ON equipment FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Equipment manageable by admins"
  ON equipment FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

-- 3. Inventory Units
CREATE TABLE IF NOT EXISTS inventory_units (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE,
  rfid_tag text UNIQUE,
  serial_number text,
  status text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'reserved', 'rented', 'maintenance', 'retired')),
  last_maintenance date,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inventory viewable by authenticated users"
  ON inventory_units FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Inventory manageable by clerks and admins"
  ON inventory_units FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin', 'clerk')
    )
  );

-- 4. Clients
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients viewable by authenticated users"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Clients manageable by admins"
  ON clients FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

-- 5. Venues
CREATE TABLE IF NOT EXISTS venues (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  address text NOT NULL,
  city text,
  distance_km numeric(10,2),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venues viewable by authenticated users"
  ON venues FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Venues manageable by admins"
  ON venues FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

-- 6. Cars
CREATE TABLE IF NOT EXISTS cars (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand text NOT NULL,
  license_plate text NOT NULL UNIQUE,
  rate_per_km_usd numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cars viewable by authenticated users"
  ON cars FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Cars manageable by admins"
  ON cars FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

-- 7. Staff
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  employment_type text NOT NULL CHECK (employment_type IN ('salary', 'contract', 'helper')),
  monthly_salary_byn numeric(10,2),
  primary_role text,
  rate_per_km_byn numeric(10,2),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff viewable by authenticated users"
  ON staff FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff manageable by admins"
  ON staff FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

-- 8. Events
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  client_id uuid REFERENCES clients(id),
  venue_id uuid REFERENCES venues(id),
  event_date date NOT NULL,
  load_in_date date,
  load_out_date date,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events viewable by authenticated users"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Events manageable by admins"
  ON events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

-- 9. Estimates
CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_number text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  event_id uuid REFERENCES events(id),
  calculation_type text NOT NULL CHECK (calculation_type IN ('dollars', 'cash_byn', 'cashless_byn')),
  usd_rate numeric(10,4),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  total_usd numeric(12,2) DEFAULT 0,
  total_byn numeric(12,2) DEFAULT 0,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(estimate_number, version)
);

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Estimates viewable by authenticated users"
  ON estimates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Estimates manageable by admins"
  ON estimates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

-- 10. Estimate Items
CREATE TABLE IF NOT EXISTS estimate_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id uuid REFERENCES estimates(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('equipment', 'work', 'delivery')),
  equipment_id uuid REFERENCES equipment(id),
  work_type text,
  car_id uuid REFERENCES cars(id),
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  days numeric(10,2) DEFAULT 1,
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  distance_km numeric(10,2),
  total_usd numeric(12,2) DEFAULT 0,
  total_byn numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Estimate items viewable by authenticated users"
  ON estimate_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Estimate items manageable by admins"
  ON estimate_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

-- 11. Work Reports
CREATE TABLE IF NOT EXISTS work_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id uuid REFERENCES events(id),
  estimate_id uuid REFERENCES estimates(id),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'paid')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Work reports viewable by authenticated users"
  ON work_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Work reports manageable by admins"
  ON work_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

-- 12. Work Distribution
CREATE TABLE IF NOT EXISTS work_distribution (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_report_id uuid REFERENCES work_reports(id) ON DELETE CASCADE,
  estimate_item_id uuid REFERENCES estimate_items(id),
  staff_id uuid REFERENCES staff(id),
  share_percentage numeric(5,2) NOT NULL DEFAULT 100,
  payment_percentage numeric(5,2) NOT NULL DEFAULT 100,
  amount_byn numeric(12,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE work_distribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Work distribution viewable by authenticated users"
  ON work_distribution FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Work distribution manageable by admins"
  ON work_distribution FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('superuser', 'admin')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_available ON equipment(available_for_rent);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_units(status);
CREATE INDEX IF NOT EXISTS idx_inventory_rfid ON inventory_units(rfid_tag);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_estimates_number ON estimates(estimate_number);
CREATE INDEX IF NOT EXISTS idx_estimates_active ON estimates(is_active);
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
/*
  # Fix RLS Infinite Recursion in Users Table

  ## Problem
  The policies "Admins can view all users" and "Admins can update users" cause infinite recursion
  because they query the users table to check if the current user is an admin, which triggers
  the same SELECT policy again in a loop.

  ## Solution
  Store the user's role in auth.jwt() app_metadata instead of checking the users table.
  This breaks the recursion cycle because auth.jwt() doesn't trigger RLS policies.

  ## Changes
  1. Drop existing admin policies that cause recursion
  2. Create new policies that use auth.jwt() instead of querying users table
  3. For now, simplify to allow users to view their own profile only
  4. Admin functionality will be handled separately via service role or functions
*/

-- Drop problematic policies
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;

-- Keep simple policies that don't cause recursion
-- Users can view their own profile
-- (already exists as "Users can view own profile")

-- Users can update their own profile  
-- (already exists as "Users can update own profile")

-- For admin operations, we'll use service role or edge functions
-- This avoids the recursion problem entirely
/*
  # Create Equipment Management Schema

  ## Overview
  Equipment rental system with categories, items, and inventory tracking

  ## New Tables
  
  ### equipment_categories
  - id (uuid, primary key)
  - name (text) - Category name (e.g., "Звук", "Свет", "Видео")
  - description (text) - Category description
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ### equipment_items
  - id (uuid, primary key)
  - category_id (uuid, foreign key) - Link to category
  - name (text) - Equipment name
  - model (text) - Model/specification
  - serial_number (text) - Serial number (optional)
  - description (text) - Detailed description
  - quantity_total (integer) - Total quantity owned
  - quantity_available (integer) - Currently available quantity
  - rental_price_daily (decimal) - Daily rental price
  - rental_price_weekly (decimal) - Weekly rental price
  - purchase_price (decimal) - Original purchase price
  - purchase_date (date) - When purchased
  - condition (text) - Current condition: excellent, good, fair, needs_repair
  - status (text) - Active, inactive, maintenance, retired
  - notes (text) - Additional notes
  - image_url (text) - Image URL
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Authenticated users can view equipment
  - Only authenticated users can view (create/update via functions later)
*/

-- Create equipment categories table
CREATE TABLE IF NOT EXISTS equipment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create equipment items table
CREATE TABLE IF NOT EXISTS equipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES equipment_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  model text DEFAULT '',
  serial_number text DEFAULT '',
  description text DEFAULT '',
  quantity_total integer NOT NULL DEFAULT 0,
  quantity_available integer NOT NULL DEFAULT 0,
  rental_price_daily decimal(10,2) DEFAULT 0,
  rental_price_weekly decimal(10,2) DEFAULT 0,
  purchase_price decimal(10,2) DEFAULT 0,
  purchase_date date,
  condition text DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'needs_repair')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'retired')),
  notes text DEFAULT '',
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for equipment_categories
CREATE POLICY "Authenticated users can view categories"
  ON equipment_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert categories"
  ON equipment_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
  ON equipment_categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete categories"
  ON equipment_categories FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for equipment_items
CREATE POLICY "Authenticated users can view equipment"
  ON equipment_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert equipment"
  ON equipment_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update equipment"
  ON equipment_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete equipment"
  ON equipment_items FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_equipment_items_category ON equipment_items(category_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_status ON equipment_items(status);
CREATE INDEX IF NOT EXISTS idx_equipment_items_name ON equipment_items(name);

-- Insert default categories
INSERT INTO equipment_categories (name, description) VALUES
  ('Звук', 'Звуковое оборудование: микрофоны, колонки, микшеры'),
  ('Свет', 'Световое оборудование: прожекторы, LED панели, контроллеры'),
  ('Видео', 'Видеооборудование: камеры, проекторы, экраны'),
  ('Сцена', 'Сценические конструкции: подиумы, декорации'),
  ('Прочее', 'Другое оборудование')
ON CONFLICT DO NOTHING;
/*
  # Update Equipment Schema to Match CSV Structure

  ## Overview
  Restructure equipment tables to match the real equipment catalog CSV format

  ## Changes
  
  ### Drop old tables
  - Drop equipment_items and equipment_categories tables
  
  ### New Tables
  
  #### equipment_items
  - id (uuid, primary key)
  - category (text) - Main category: Видео, Звук, Кабель, Сцена, Свет, Связь, Спецэффекты, Электроснабжение, Коннектор, Прочее
  - type (text) - Type: Оборудование, Крепление, Стойка, etc.
  - subtype (text) - Subtype: specific equipment type
  - name (text) - Full equipment name
  - note (text) - Additional notes/description
  - attribute (text) - Short name/code
  - sku (text, unique) - Article number (e.g., VI_FIX_FRM)
  - quantity (integer) - Total quantity available
  - rental_price (decimal) - Rental price in dollars
  - power (text) - Power consumption (for electrical equipment)
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ## Security
  - Enable RLS on equipment_items table
  - Authenticated users can view/manage equipment
*/

-- Drop old tables if they exist
DROP TABLE IF EXISTS equipment_items CASCADE;
DROP TABLE IF EXISTS equipment_categories CASCADE;

-- Create new equipment_items table matching CSV structure
CREATE TABLE IF NOT EXISTS equipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT '',
  subtype text NOT NULL DEFAULT '',
  name text NOT NULL,
  note text DEFAULT '',
  attribute text DEFAULT '',
  sku text UNIQUE,
  quantity integer NOT NULL DEFAULT 0,
  rental_price decimal(10,2) DEFAULT 0,
  power text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_equipment_items_category ON equipment_items(category);
CREATE INDEX IF NOT EXISTS idx_equipment_items_type ON equipment_items(type);
CREATE INDEX IF NOT EXISTS idx_equipment_items_subtype ON equipment_items(subtype);
CREATE INDEX IF NOT EXISTS idx_equipment_items_sku ON equipment_items(sku);
CREATE INDEX IF NOT EXISTS idx_equipment_items_name ON equipment_items(name);

-- Enable RLS
ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for equipment_items
CREATE POLICY "Authenticated users can view equipment"
  ON equipment_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert equipment"
  ON equipment_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update equipment"
  ON equipment_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete equipment"
  ON equipment_items FOR DELETE
  TO authenticated
  USING (true);
/*
  # Update Events Management Schema

  ## Overview
  Update existing tables to match requirements for events management system

  ## Changes
  
  ### Update clients table
  - Add organization field (rename name to organization)
  - Add full_name field (rename contact_person)
  - Add position field
  - Keep phone, email, notes

  ### Create organizers table
  - New table for coordinators
  
  ### Update events table
  - Add event_type field
  - Add budget field
  - Add specification field
  - Update status values
  - Add organizer_id foreign key
  - Add progress tracking fields
  
  ### Update venues table
  - Add contact, capacity, description fields

  ## Security
  - All tables already have RLS enabled
*/

-- First, update clients table structure
DO $$
BEGIN
  -- Rename name column to organization if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'name'
  ) THEN
    ALTER TABLE clients RENAME COLUMN name TO organization;
  END IF;

  -- Rename contact_person to full_name if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE clients RENAME COLUMN contact_person TO full_name;
  END IF;

  -- Add position column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'position'
  ) THEN
    ALTER TABLE clients ADD COLUMN position text DEFAULT '';
  END IF;
END $$;

-- Update venues table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'venues' AND column_name = 'contact'
  ) THEN
    ALTER TABLE venues ADD COLUMN contact text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'venues' AND column_name = 'capacity'
  ) THEN
    ALTER TABLE venues ADD COLUMN capacity integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'venues' AND column_name = 'description'
  ) THEN
    ALTER TABLE venues ADD COLUMN description text DEFAULT '';
  END IF;
END $$;

-- Create organizers table
CREATE TABLE IF NOT EXISTS organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  position text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizers_full_name ON organizers(full_name);

-- Enable RLS for organizers
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizers
CREATE POLICY "Authenticated users can view organizers"
  ON organizers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert organizers"
  ON organizers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update organizers"
  ON organizers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete organizers"
  ON organizers FOR DELETE
  TO authenticated
  USING (true);

-- Update events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE events ADD COLUMN event_type text DEFAULT 'Концерт';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'budget'
  ) THEN
    ALTER TABLE events ADD COLUMN budget text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'specification'
  ) THEN
    ALTER TABLE events ADD COLUMN specification text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'organizer_id'
  ) THEN
    ALTER TABLE events ADD COLUMN organizer_id uuid REFERENCES organizers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'progress_budget_done'
  ) THEN
    ALTER TABLE events ADD COLUMN progress_budget_done boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'progress_equipment_reserved'
  ) THEN
    ALTER TABLE events ADD COLUMN progress_equipment_reserved boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'progress_project_completed'
  ) THEN
    ALTER TABLE events ADD COLUMN progress_project_completed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'progress_paid'
  ) THEN
    ALTER TABLE events ADD COLUMN progress_paid boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for events
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);
/*
  # Remove load_in_date and load_out_date from events table

  1. Changes
    - Drop `load_in_date` column from `events` table
    - Drop `load_out_date` column from `events` table
  
  2. Notes
    - These columns are no longer needed as per user requirements
    - Only event_date (the date of the event itself) is required
*/

-- Remove the load dates columns
ALTER TABLE events DROP COLUMN IF EXISTS load_in_date;
ALTER TABLE events DROP COLUMN IF EXISTS load_out_date;
/*
  # Update events status constraint to use Russian values

  1. Changes
    - Drop existing `events_status_check` constraint
    - Add new constraint with Russian status values matching the frontend
    - Update event_type constraint to match Russian values from frontend
  
  2. Notes
    - Frontend uses Russian values: 'Запрос', 'На рассмотрении', 'Подтверждено'
    - Frontend uses Russian event types: 'Концерт', 'Свадьба', 'Семинар', 'Выставка', 'Встреча', 'Фестиваль'
*/

-- Drop existing constraints
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check;

-- Add new constraint with Russian status values
ALTER TABLE events ADD CONSTRAINT events_status_check 
  CHECK (status IN ('Запрос', 'На рассмотрении', 'Подтверждено'));

-- Add new constraint with Russian event type values
ALTER TABLE events ADD CONSTRAINT events_event_type_check 
  CHECK (event_type IN ('Концерт', 'Свадьба', 'Семинар', 'Выставка', 'Встреча', 'Фестиваль'));
/*
  # Create budget items schema

  1. New Tables
    - `budget_items`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to events) - мероприятие
      - `equipment_id` (uuid, foreign key to equipment) - оборудование из справочника
      - `quantity` (integer) - количество единиц оборудования
      - `price` (decimal) - цена за единицу на момент добавления в смету
      - `total` (decimal, computed) - общая стоимость (quantity * price)
      - `notes` (text, nullable) - примечания к позиции
      - `created_at` (timestamptz) - дата создания
      - `updated_at` (timestamptz) - дата обновления

  2. Security
    - Enable RLS on `budget_items` table
    - Add policies for authenticated users to manage budget items for their events

  3. Notes
    - Price is stored at the time of adding to budget to preserve historical data
    - Total is calculated automatically via trigger
    - Users can only manage budget items for events they have access to
*/

-- Create budget_items table
CREATE TABLE IF NOT EXISTS budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price decimal(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  total decimal(10,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_budget_items_event_id ON budget_items(event_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_equipment_id ON budget_items(equipment_id);

-- Create function to automatically calculate total
CREATE OR REPLACE FUNCTION calculate_budget_item_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total := NEW.quantity * NEW.price;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update total on insert or update
DROP TRIGGER IF EXISTS budget_items_calculate_total ON budget_items;
CREATE TRIGGER budget_items_calculate_total
  BEFORE INSERT OR UPDATE OF quantity, price ON budget_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_budget_item_total();

-- Enable RLS
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

-- Policies for budget_items
CREATE POLICY "Users can view budget items for all events"
  ON budget_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert budget items for events"
  ON budget_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update budget items for events"
  ON budget_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete budget items for events"
  ON budget_items FOR DELETE
  TO authenticated
  USING (true);
/*
  # Fix budget_items to reference equipment_items table

  1. Changes
    - Drop existing foreign key constraint on equipment_id
    - Add new foreign key constraint referencing equipment_items table
  
  2. Notes
    - The actual equipment table is named equipment_items, not equipment
*/

-- Drop old constraint if exists
ALTER TABLE budget_items DROP CONSTRAINT IF EXISTS budget_items_equipment_id_fkey;

-- Add new constraint referencing the correct table
ALTER TABLE budget_items 
  ADD CONSTRAINT budget_items_equipment_id_fkey 
  FOREIGN KEY (equipment_id) 
  REFERENCES equipment_items(id) 
  ON DELETE RESTRICT;
/*
  # Add exchange rate to budget items

  1. Changes
    - Add `exchange_rate` column to budget_items table (курс доллара в BYN)
    - Default value is 3 BYN per USD
  
  2. Notes
    - Exchange rate will be used to convert USD prices to BYN
    - BYN non-cash = (price * exchange_rate * quantity * 1.2) rounded to nearest 5
*/

-- Add exchange_rate column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'exchange_rate'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN exchange_rate decimal(10,2) NOT NULL DEFAULT 3.00 CHECK (exchange_rate > 0);
  END IF;
END $$;
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
/*
  # Create Work Items Schema

  1. New Tables
    - `work_items`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text) - Наименование работы
      - `unit` (text) - Единица измерения
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `work_items` table
    - Add policies for authenticated users to manage work items
*/

CREATE TABLE IF NOT EXISTS work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  unit text DEFAULT 'шт',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own work items"
  ON work_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own work items"
  ON work_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own work items"
  ON work_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own work items"
  ON work_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_work_items_user_id ON work_items(user_id);
/*
  # Update Budget Items for Work and Personnel

  1. Changes to Tables
    - Add `item_type` column to `budget_items` to distinguish between 'equipment' and 'work'
    - Add `work_item_id` column to reference work_items
    - Create junction table `budget_item_personnel` for many-to-many relationship

  2. New Tables
    - `budget_item_personnel`
      - `id` (uuid, primary key)
      - `budget_item_id` (uuid, references budget_items)
      - `personnel_id` (uuid, references personnel)
      - `created_at` (timestamp)

  3. Security
    - Enable RLS on `budget_item_personnel` table
    - Add policies for authenticated users
*/

-- Add new columns to budget_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'item_type'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN item_type text DEFAULT 'equipment' CHECK (item_type IN ('equipment', 'work'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'work_item_id'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN work_item_id uuid REFERENCES work_items(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create junction table for budget items and personnel
CREATE TABLE IF NOT EXISTS budget_item_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_item_id uuid REFERENCES budget_items(id) ON DELETE CASCADE NOT NULL,
  personnel_id uuid REFERENCES personnel(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(budget_item_id, personnel_id)
);

ALTER TABLE budget_item_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view budget item personnel"
  ON budget_item_personnel FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert budget item personnel"
  ON budget_item_personnel FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete budget item personnel"
  ON budget_item_personnel FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_budget_item_personnel_budget_item ON budget_item_personnel(budget_item_id);
CREATE INDEX IF NOT EXISTS idx_budget_item_personnel_personnel ON budget_item_personnel(personnel_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_work_item ON budget_items(work_item_id);
/*
  # Add Unique Constraint to Work Items

  1. Changes
    - Add unique constraint on (name, user_id) to prevent duplicate work items
    - This allows upsert operations to work correctly during CSV imports
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'work_items_name_user_id_key'
  ) THEN
    ALTER TABLE work_items ADD CONSTRAINT work_items_name_user_id_key UNIQUE (name, user_id);
  END IF;
END $$;
/*
  # Fix Budget Items Nullable Fields

  1. Changes
    - Make equipment_id nullable (allow NULL when item_type is 'work')
    - Make work_item_id nullable (allow NULL when item_type is 'equipment')
    - Add constraint to ensure at least one of equipment_id or work_item_id is set
*/

-- Make equipment_id nullable
ALTER TABLE budget_items ALTER COLUMN equipment_id DROP NOT NULL;

-- Add check constraint to ensure either equipment_id or work_item_id is set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'budget_items_has_item'
  ) THEN
    ALTER TABLE budget_items ADD CONSTRAINT budget_items_has_item 
    CHECK (
      (item_type = 'equipment' AND equipment_id IS NOT NULL AND work_item_id IS NULL) OR
      (item_type = 'work' AND work_item_id IS NOT NULL AND equipment_id IS NULL)
    );
  END IF;
END $$;
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
/*
  # Add Category to Budget Items

  1. Changes
    - Add `category_id` column to `budget_items` table
    - Add foreign key constraint to `categories` table
    - Add `sort_order` column for custom ordering within categories
    - Create index for better query performance

  2. Notes
    - category_id is nullable to allow items without categories
    - sort_order defaults to 0
*/

-- Add category_id and sort_order columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_budget_items_category_id ON budget_items(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_sort_order ON budget_items(sort_order);
/*
  # Add Equipment Type Fields

  1. Changes
    - Add `object_type` column to `equipment` table
      - Values: 'physical' or 'virtual'
      - Default: 'physical'
    - Add `rental_type` column to `equipment` table  
      - Values: 'rental' or 'sublease'
      - Default: 'rental'
    - Add `has_composition` column to `equipment` table
      - Boolean indicating if equipment can contain other items
      - Default: false

  2. Notes
    - These fields help categorize equipment for better inventory management
    - Physical equipment = actual items that may include other materials
    - Virtual equipment = combinations of separate materials
    - Rental = equipment returned to warehouse after use
    - Sublease = equipment not returned after project
    - Has composition = can contain other equipment items
*/

-- Add object_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'object_type'
  ) THEN
    ALTER TABLE equipment ADD COLUMN object_type text DEFAULT 'physical' CHECK (object_type IN ('physical', 'virtual'));
  END IF;
END $$;

-- Add rental_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'rental_type'
  ) THEN
    ALTER TABLE equipment ADD COLUMN rental_type text DEFAULT 'rental' CHECK (rental_type IN ('rental', 'sublease'));
  END IF;
END $$;

-- Add has_composition column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'has_composition'
  ) THEN
    ALTER TABLE equipment ADD COLUMN has_composition boolean DEFAULT false;
  END IF;
END $$;/*
  # Add Equipment Items Type Fields

  1. Changes
    - Add `object_type` column to `equipment_items` table
      - Values: 'physical' or 'virtual'
      - Default: 'physical'
    - Add `rental_type` column to `equipment_items` table  
      - Values: 'rental' or 'sublease'
      - Default: 'rental'
    - Add `has_composition` column to `equipment_items` table
      - Boolean indicating if equipment can contain other items
      - Default: false

  2. Notes
    - These fields help categorize equipment for better inventory management
    - Physical equipment = actual items that may include other materials
    - Virtual equipment = combinations of separate materials
    - Rental = equipment returned to warehouse after use
    - Sublease = equipment not returned after project
    - Has composition = can contain other equipment items
*/

-- Add object_type column to equipment_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_items' AND column_name = 'object_type'
  ) THEN
    ALTER TABLE equipment_items ADD COLUMN object_type text DEFAULT 'physical' CHECK (object_type IN ('physical', 'virtual'));
  END IF;
END $$;

-- Add rental_type column to equipment_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_items' AND column_name = 'rental_type'
  ) THEN
    ALTER TABLE equipment_items ADD COLUMN rental_type text DEFAULT 'rental' CHECK (rental_type IN ('rental', 'sublease'));
  END IF;
END $$;

-- Add has_composition column to equipment_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_items' AND column_name = 'has_composition'
  ) THEN
    ALTER TABLE equipment_items ADD COLUMN has_composition boolean DEFAULT false;
  END IF;
END $$;/*
  # Create Equipment Compositions Table

  1. New Tables
    - `equipment_compositions`
      - `id` (uuid, primary key)
      - `parent_id` (uuid, references equipment_items) - родительское оборудование
      - `child_id` (uuid, references equipment_items) - дочерний элемент
      - `quantity` (integer) - количество единиц дочернего элемента
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `equipment_compositions` table
    - Add policies for authenticated users to manage compositions

  3. Indexes
    - Index on parent_id for fast lookups
    - Index on child_id for fast reverse lookups
    - Unique constraint on (parent_id, child_id) to prevent duplicates
*/

-- Create equipment_compositions table
CREATE TABLE IF NOT EXISTS equipment_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(parent_id, child_id),
  CHECK (parent_id != child_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_equipment_compositions_parent ON equipment_compositions(parent_id);
CREATE INDEX IF NOT EXISTS idx_equipment_compositions_child ON equipment_compositions(child_id);

-- Enable RLS
ALTER TABLE equipment_compositions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view all compositions"
  ON equipment_compositions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert compositions"
  ON equipment_compositions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update compositions"
  ON equipment_compositions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete compositions"
  ON equipment_compositions FOR DELETE
  TO authenticated
  USING (true);/*
  # Add Sort Order Fields

  1. Changes
    - Add `sort_order` field to `categories` table for custom ordering
    - Add `sort_order` field to `budget_items` table for custom ordering within categories

  2. Notes
    - Default sort_order is 0
    - Lower numbers appear first
    - Allows manual reordering via drag-and-drop
*/

-- Add sort_order to categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE categories ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;

-- Add sort_order to budget_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_budget_items_sort_order ON budget_items(category_id, sort_order);/*
  # Создание таблицы выплат

  1. Новые таблицы
    - `payments`
      - `id` (uuid, primary key) - Уникальный идентификатор выплаты
      - `personnel_id` (uuid, foreign key) - Связь с сотрудником/подрядчиком
      - `event_id` (uuid, nullable, foreign key) - Связь с мероприятием
      - `budget_item_id` (uuid, nullable, foreign key) - Связь с элементом сметы
      - `month` (date) - Месяц выплаты (хранится как первое число месяца)
      - `amount` (numeric) - Сумма выплаты в рублях
      - `status` (text) - Статус выплаты (Запланировано, Выплачено, Просрочено)
      - `payment_date` (date, nullable) - Фактическая дата выплаты
      - `notes` (text, nullable) - Примечания к выплате
      - `created_at` (timestamptz) - Дата создания записи
      - `updated_at` (timestamptz) - Дата последнего обновления

  2. Безопасность
    - Включение RLS для таблицы `payments`
    - Политики для аутентифицированных пользователей:
      - SELECT: Чтение всех записей о выплатах
      - INSERT: Создание новых записей о выплатах
      - UPDATE: Обновление записей о выплатах
      - DELETE: Удаление записей о выплатах

  3. Индексы
    - Индекс по personnel_id для быстрого поиска выплат сотруднику
    - Индекс по event_id для поиска выплат по мероприятию
    - Индекс по month для фильтрации по месяцам
    - Индекс по status для фильтрации по статусу
*/

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  budget_item_id uuid REFERENCES budget_items(id) ON DELETE SET NULL,
  month date NOT NULL,
  amount numeric(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Запланировано',
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_payments_personnel_id ON payments(personnel_id);
CREATE INDEX IF NOT EXISTS idx_payments_event_id ON payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Включаем RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Политики доступа для аутентифицированных пользователей
CREATE POLICY "Authenticated users can view all payments"
  ON payments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payments"
  ON payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments"
  ON payments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete payments"
  ON payments
  FOR DELETE
  TO authenticated
  USING (true);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS payments_updated_at_trigger ON payments;
CREATE TRIGGER payments_updated_at_trigger
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();/*
  # Создание триггера для автоматического создания выплат

  1. Функция триггера
    - Автоматически создает запись о выплате при добавлении персонала в элемент сметы
    - Извлекает месяц мероприятия из даты начала мероприятия
    - Использует сумму из элемента сметы
    - Устанавливает статус "Запланировано"

  2. Триггер
    - Срабатывает при INSERT на таблице budget_items
    - Только для элементов с типом "personnel" (personnel_id не NULL)
    - Вызывает функцию создания записи о выплате

  3. Важные примечания
    - Триггер создает выплату только для новых элементов сметы с персоналом
    - Месяц выплаты берется из даты начала мероприятия
    - Если event_id отсутствует, выплата не создается
*/

CREATE OR REPLACE FUNCTION create_payment_from_budget_item()
RETURNS TRIGGER AS $$
DECLARE
  event_start_date date;
  payment_month date;
BEGIN
  IF NEW.personnel_id IS NOT NULL AND NEW.event_id IS NOT NULL THEN
    SELECT start_date INTO event_start_date
    FROM events
    WHERE id = NEW.event_id;
    
    IF event_start_date IS NOT NULL THEN
      payment_month := date_trunc('month', event_start_date)::date;
      
      INSERT INTO payments (
        personnel_id,
        event_id,
        budget_item_id,
        month,
        amount,
        status
      ) VALUES (
        NEW.personnel_id,
        NEW.event_id,
        NEW.id,
        payment_month,
        NEW.total_rub,
        'Запланировано'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_payment_on_budget_item_insert ON budget_items;
CREATE TRIGGER create_payment_on_budget_item_insert
  AFTER INSERT ON budget_items
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_from_budget_item();/*
  # Исправление триггера создания выплат

  1. Проблема
    - Старый триггер пытался обращаться к несуществующему полю personnel_id в таблице budget_items
    - Связь между budget_items и персоналом осуществляется через junction table budget_item_personnel

  2. Решение
    - Удаляем старый триггер на budget_items
    - Создаем новый триггер на budget_item_personnel
    - Новый триггер срабатывает при добавлении персонала к элементу сметы

  3. Логика нового триггера
    - Извлекает event_id из budget_item
    - Извлекает дату начала мероприятия
    - Извлекает сумму из budget_item (поле total_rub)
    - Создает запись о выплате на месяц начала мероприятия
*/

-- Удаляем старый триггер и функцию
DROP TRIGGER IF EXISTS create_payment_on_budget_item_insert ON budget_items;
DROP FUNCTION IF EXISTS create_payment_from_budget_item();

-- Создаем новую функцию для создания выплаты при назначении персонала
CREATE OR REPLACE FUNCTION create_payment_from_personnel_assignment()
RETURNS TRIGGER AS $$
DECLARE
  budget_event_id uuid;
  budget_total_rub numeric;
  event_start_date date;
  payment_month date;
BEGIN
  -- Получаем event_id и total_rub из budget_items
  SELECT event_id, total_rub INTO budget_event_id, budget_total_rub
  FROM budget_items
  WHERE id = NEW.budget_item_id;
  
  -- Если event_id найден, получаем дату начала мероприятия
  IF budget_event_id IS NOT NULL THEN
    SELECT start_date INTO event_start_date
    FROM events
    WHERE id = budget_event_id;
    
    -- Если дата найдена, создаем выплату
    IF event_start_date IS NOT NULL THEN
      payment_month := date_trunc('month', event_start_date)::date;
      
      INSERT INTO payments (
        personnel_id,
        event_id,
        budget_item_id,
        month,
        amount,
        status
      ) VALUES (
        NEW.personnel_id,
        budget_event_id,
        NEW.budget_item_id,
        payment_month,
        COALESCE(budget_total_rub, 0),
        'Запланировано'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер на budget_item_personnel
DROP TRIGGER IF EXISTS create_payment_on_personnel_assignment ON budget_item_personnel;
CREATE TRIGGER create_payment_on_personnel_assignment
  AFTER INSERT ON budget_item_personnel
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_from_personnel_assignment();/*
  # Исправление триггера выплат - расчет total_rub

  1. Проблема
    - Триггер пытается обратиться к несуществующей колонке total_rub в budget_items
    - В таблице есть колонки: total (в USD), exchange_rate (курс обмена)
  
  2. Решение
    - Изменяем функцию триггера для вычисления суммы в рублях
    - Используем формулу: total * exchange_rate
  
  3. Изменения
    - Обновляем функцию create_payment_from_personnel_assignment
    - Вычисляем total_rub как total * exchange_rate
*/

-- Пересоздаем функцию с правильным расчетом
CREATE OR REPLACE FUNCTION create_payment_from_personnel_assignment()
RETURNS TRIGGER AS $$
DECLARE
  budget_event_id uuid;
  budget_total numeric;
  budget_exchange_rate numeric;
  budget_total_rub numeric;
  event_start_date date;
  payment_month date;
BEGIN
  -- Получаем event_id, total и exchange_rate из budget_items
  SELECT event_id, total, exchange_rate 
  INTO budget_event_id, budget_total, budget_exchange_rate
  FROM budget_items
  WHERE id = NEW.budget_item_id;
  
  -- Вычисляем сумму в рублях
  budget_total_rub := budget_total * budget_exchange_rate;
  
  -- Если event_id найден, получаем дату начала мероприятия
  IF budget_event_id IS NOT NULL THEN
    SELECT start_date INTO event_start_date
    FROM events
    WHERE id = budget_event_id;
    
    -- Если дата найдена, создаем выплату
    IF event_start_date IS NOT NULL THEN
      payment_month := date_trunc('month', event_start_date)::date;
      
      INSERT INTO payments (
        personnel_id,
        event_id,
        budget_item_id,
        month,
        amount,
        status
      ) VALUES (
        NEW.personnel_id,
        budget_event_id,
        NEW.budget_item_id,
        payment_month,
        COALESCE(budget_total_rub, 0),
        'Запланировано'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;/*
  # Исправление триггера выплат - использование правильного поля даты

  1. Проблема
    - Триггер пытается обратиться к несуществующей колонке start_date в events
    - В таблице events используется колонка event_date, а не start_date
  
  2. Решение
    - Изменяем функцию триггера для использования event_date вместо start_date
  
  3. Изменения
    - Обновляем функцию create_payment_from_personnel_assignment
    - Заменяем start_date на event_date
*/

-- Пересоздаем функцию с правильным названием колонки
CREATE OR REPLACE FUNCTION create_payment_from_personnel_assignment()
RETURNS TRIGGER AS $$
DECLARE
  budget_event_id uuid;
  budget_total numeric;
  budget_exchange_rate numeric;
  budget_total_rub numeric;
  event_date_value date;
  payment_month date;
BEGIN
  -- Получаем event_id, total и exchange_rate из budget_items
  SELECT event_id, total, exchange_rate 
  INTO budget_event_id, budget_total, budget_exchange_rate
  FROM budget_items
  WHERE id = NEW.budget_item_id;
  
  -- Вычисляем сумму в рублях
  budget_total_rub := budget_total * budget_exchange_rate;
  
  -- Если event_id найден, получаем дату мероприятия
  IF budget_event_id IS NOT NULL THEN
    SELECT event_date INTO event_date_value
    FROM events
    WHERE id = budget_event_id;
    
    -- Если дата найдена, создаем выплату
    IF event_date_value IS NOT NULL THEN
      payment_month := date_trunc('month', event_date_value)::date;
      
      INSERT INTO payments (
        personnel_id,
        event_id,
        budget_item_id,
        month,
        amount,
        status
      ) VALUES (
        NEW.personnel_id,
        budget_event_id,
        NEW.budget_item_id,
        payment_month,
        COALESCE(budget_total_rub, 0),
        'Запланировано'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;/*
  # Исправление RLS политик для таблицы personnel
  
  1. Изменения
    - Удаление старой ограничительной политики SELECT для personnel
    - Создание новой политики, позволяющей всем аутентифицированным пользователям просматривать всех работников
    - Это необходимо для корректной работы страницы выплат, которая делает джойн с таблицей personnel
  
  2. Безопасность
    - Просмотр: Все аутентифицированные пользователи могут видеть всех работников
    - Создание/Изменение/Удаление: Только владелец записи (user_id = auth.uid())
*/

-- Удаляем старую ограничительную политику
DROP POLICY IF EXISTS "Users can view own personnel" ON personnel;

-- Создаем новую политику для просмотра всех работников аутентифицированными пользователями
CREATE POLICY "Authenticated users can view all personnel"
  ON personnel
  FOR SELECT
  TO authenticated
  USING (true);
/*
  # Fix Personnel RLS for Payments Access

  Allow all authenticated users to read all personnel records since payments
  may reference personnel created by other users.
*/

DROP POLICY IF EXISTS "Authenticated users can view all personnel" ON personnel;

CREATE POLICY "Authenticated users can view all personnel"
  ON personnel FOR SELECT
  TO authenticated
  USING (true);
/*
  # Fix Payment Duplication and Add Work Item Link

  1. Problem
    - When editing personnel assignments, old payment records remain
    - New payments are created on insert, causing duplicates
    - No link between payments and work_items

  2. Solutions
    - Add delete trigger to remove payments when personnel assignments are deleted
    - Add work_item_id column to payments table
    - Update trigger to include work_item_id from budget_items

  3. Changes
    - New column: payments.work_item_id (uuid, nullable, FK to work_items)
    - New trigger: delete_payment_on_personnel_unassignment (DELETE on budget_item_personnel)
    - Updated trigger: create_payment_on_personnel_assignment (now includes work_item_id)
*/

-- Add work_item_id to payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'work_item_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN work_item_id uuid REFERENCES work_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create delete trigger for payments
CREATE OR REPLACE FUNCTION delete_payment_on_personnel_unassignment()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM payments
  WHERE budget_item_id = OLD.budget_item_id
    AND personnel_id = OLD.personnel_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS delete_payment_on_personnel_unassignment ON budget_item_personnel;
CREATE TRIGGER delete_payment_on_personnel_unassignment
  AFTER DELETE ON budget_item_personnel
  FOR EACH ROW
  EXECUTE FUNCTION delete_payment_on_personnel_unassignment();

-- Update insert trigger to include work_item_id
CREATE OR REPLACE FUNCTION create_payment_from_personnel_assignment()
RETURNS TRIGGER AS $$
DECLARE
  budget_event_id uuid;
  budget_total_rub numeric;
  budget_work_item_id uuid;
  event_start_date date;
  payment_month date;
BEGIN
  -- Get event_id, total_rub, and work_item_id from budget_items
  SELECT event_id, total_rub, work_item_id INTO budget_event_id, budget_total_rub, budget_work_item_id
  FROM budget_items
  WHERE id = NEW.budget_item_id;
  
  -- If event_id is found, get the event start date
  IF budget_event_id IS NOT NULL THEN
    SELECT start_date INTO event_start_date
    FROM events
    WHERE id = budget_event_id;
    
    -- If date is found, create payment
    IF event_start_date IS NOT NULL THEN
      payment_month := date_trunc('month', event_start_date)::date;
      
      INSERT INTO payments (
        personnel_id,
        event_id,
        budget_item_id,
        work_item_id,
        month,
        amount,
        status
      ) VALUES (
        NEW.personnel_id,
        budget_event_id,
        NEW.budget_item_id,
        budget_work_item_id,
        payment_month,
        COALESCE(budget_total_rub, 0),
        'Запланировано'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_payment_on_personnel_assignment ON budget_item_personnel;
CREATE TRIGGER create_payment_on_personnel_assignment
  AFTER INSERT ON budget_item_personnel
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_from_personnel_assignment();/*
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
/*
  # Add Price Field to Template Items

  1. Modified Tables
    - `template_items`
      - `price` (numeric) - цена за единицу оборудования (может отличаться от стандартной цены)
      - `exchange_rate` (numeric) - курс валюты если нужно

  2. Notes
    - Цена сохраняется со шаблоном для последующего применения в смету
    - Позволяет иметь разные цены для одного оборудования в разных шаблонах
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'template_items' AND column_name = 'price'
  ) THEN
    ALTER TABLE template_items ADD COLUMN price numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'template_items' AND column_name = 'exchange_rate'
  ) THEN
    ALTER TABLE template_items ADD COLUMN exchange_rate numeric DEFAULT 1;
  END IF;
END $$;
/*
  # Create Warehouse Specification Items Schema

  1. New Tables
    - `warehouse_specification_cables`
      - `id` (uuid, primary key)
      - `event_id` (uuid, references events)
      - `cable_type` (text) - тип кабеля (POWERCON, DMX, XLR, SCREEN, Удлинители)
      - `cable_length` (text) - длина кабеля (1м, 2м, 5м, и т.д.)
      - `quantity` (integer) - количество
      - `notes` (text) - примечания
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `warehouse_specification_connectors`
      - `id` (uuid, primary key)
      - `event_id` (uuid, references events)
      - `connector_type` (text) - тип коннектора (Сплиттер X6, Карабулька X2, Состыковка)
      - `quantity` (integer) - количество
      - `notes` (text) - примечания
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their specification items

  3. Indexes
    - Index on event_id for fast lookups
    - Index on cable_type and connector_type for filtering
*/

-- Create warehouse_specification_cables table
CREATE TABLE IF NOT EXISTS warehouse_specification_cables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  cable_type text NOT NULL,
  cable_length text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create warehouse_specification_connectors table
CREATE TABLE IF NOT EXISTS warehouse_specification_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  connector_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_cables_event ON warehouse_specification_cables(event_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_cables_type ON warehouse_specification_cables(cable_type);
CREATE INDEX IF NOT EXISTS idx_warehouse_connectors_event ON warehouse_specification_connectors(event_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_connectors_type ON warehouse_specification_connectors(connector_type);

-- Enable RLS
ALTER TABLE warehouse_specification_cables ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_specification_connectors ENABLE ROW LEVEL SECURITY;

-- Create policies for cables
CREATE POLICY "Authenticated users can view all cables"
  ON warehouse_specification_cables FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cables"
  ON warehouse_specification_cables FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cables"
  ON warehouse_specification_cables FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete cables"
  ON warehouse_specification_cables FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for connectors
CREATE POLICY "Authenticated users can view all connectors"
  ON warehouse_specification_connectors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert connectors"
  ON warehouse_specification_connectors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update connectors"
  ON warehouse_specification_connectors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete connectors"
  ON warehouse_specification_connectors FOR DELETE
  TO authenticated
  USING (true);
/*
  # Add warehouse role to users table
  
  1. Changes
    - Drop existing role check constraint
    - Add new role check constraint that includes 'warehouse' role
  
  2. Notes
    - This allows users to have the 'warehouse' role in addition to existing roles
    - Warehouse users have minimal access level for viewing and confirming specifications
*/

-- Drop the existing constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with warehouse role
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role = ANY (ARRAY['superuser'::text, 'admin'::text, 'clerk'::text, 'staff'::text, 'warehouse'::text]));
/*
  # Create equipment modifications system

  1. New Tables
    - `equipment_modifications`
      - `id` (uuid, primary key)
      - `equipment_id` (uuid, references equipment_items)
      - `name` (text) - e.g., "на стойках", "в подвесе"
      - `description` (text, optional)
      - `sort_order` (integer)
      - `created_at` (timestamp)
    
    - `modification_components`
      - `id` (uuid, primary key)
      - `modification_id` (uuid, references equipment_modifications)
      - `component_equipment_id` (uuid, references equipment_items)
      - `quantity` (integer)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users

  3. Relationships
    - equipment_modifications references equipment_items
    - modification_components references equipment_modifications and equipment_items
    - When selecting equipment with modifications, include all components in warehouse specification
*/

CREATE TABLE IF NOT EXISTS equipment_modifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT ''::text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modification_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modification_id uuid NOT NULL REFERENCES equipment_modifications(id) ON DELETE CASCADE,
  component_equipment_id uuid NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE modification_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view equipment modifications"
  ON equipment_modifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view modification components"
  ON modification_components FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage equipment modifications"
  ON equipment_modifications FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'superuser')
    )
  ));

CREATE POLICY "Admin can update equipment modifications"
  ON equipment_modifications FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  ));

CREATE POLICY "Admin can delete equipment modifications"
  ON equipment_modifications FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  ));

CREATE POLICY "Admin can manage modification components"
  ON modification_components FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  ));

CREATE POLICY "Admin can update modification components"
  ON modification_components FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  ));

CREATE POLICY "Admin can delete modification components"
  ON modification_components FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  ));

CREATE INDEX IF NOT EXISTS equipment_modifications_equipment_id_idx ON equipment_modifications(equipment_id);
CREATE INDEX IF NOT EXISTS modification_components_modification_id_idx ON modification_components(modification_id);
CREATE INDEX IF NOT EXISTS modification_components_component_id_idx ON modification_components(component_equipment_id);
/*
  # Add modification_id to budget_items

  1. Changes
    - `budget_items.modification_id` (uuid, nullable) - references equipment_modifications
    - When equipment item has modifications, user must select one
    - When modification is selected, its components are added to warehouse specification

  2. Relationships
    - budget_items.modification_id references equipment_modifications.id
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'modification_id'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN modification_id uuid REFERENCES equipment_modifications(id) ON DELETE SET NULL;
    CREATE INDEX budget_items_modification_id_idx ON budget_items(modification_id);
  END IF;
END $$;
/*
  # Create example screen equipment with modifications

  1. New Equipment
    - Screen 4x2.5m - main equipment item
  
  2. New Modifications
    - "На стойках" (on stands) - with stands and cables
    - "В подвесе" (suspended) - with truss and rigging hardware

  3. Components for modifications
    - Each modification has its own set of components
    - When selected, all components are added to warehouse specification

  This is an example setup showing how modifications work.
*/

-- Insert the main screen equipment
INSERT INTO equipment_items (category, type, subtype, name, sku, quantity, rental_price, object_type, rental_type, has_composition)
VALUES ('Видео', 'Экран', 'LED', 'Экран 4х2,5м', 'SCREEN-4X2.5', 1, 500, 'physical', 'rental', false)
ON CONFLICT (sku) DO NOTHING;

-- Get the screen ID for reference
WITH screen AS (
  SELECT id FROM equipment_items WHERE sku = 'SCREEN-4X2.5' LIMIT 1
),
stands AS (
  SELECT id FROM equipment_items WHERE sku LIKE '%стойк%' OR name LIKE '%стойка%' LIMIT 1
),
cable AS (
  SELECT id FROM equipment_items WHERE name LIKE '%кабель%' OR name LIKE '%провод%' LIMIT 1
),
truss AS (
  SELECT id FROM equipment_items WHERE name LIKE '%ферма%' OR name LIKE '%трасса%' LIMIT 1
),
rigging AS (
  SELECT id FROM equipment_items WHERE name LIKE '%навеска%' OR name LIKE '%крепление%' LIMIT 1
)
INSERT INTO equipment_modifications (equipment_id, name, description, sort_order)
SELECT screen.id, 'На стойках', 'Экран установлен на стойках', 0 FROM screen
ON CONFLICT DO NOTHING;

-- If the modifications were created, add their components
-- This is a simplified example - in reality you would add actual components
-- For now, we just create the modification structure
/*
  # Add suspension modification to screen

  1. Add second modification
    - "В подвесе" (suspended)
*/

WITH screen AS (
  SELECT id FROM equipment_items WHERE sku = 'SCREEN-4X2.5' LIMIT 1
)
INSERT INTO equipment_modifications (equipment_id, name, description, sort_order)
SELECT screen.id, 'В подвесе', 'Экран подвешен на ферме', 1 FROM screen
WHERE NOT EXISTS (
  SELECT 1 FROM equipment_modifications 
  WHERE equipment_id = screen.id AND name = 'В подвесе'
)
ON CONFLICT DO NOTHING;
/*
  # Add components for stand modification
  
  Add TV stand components to "На стойках" modification
*/

WITH mod_stands AS (
  SELECT em.id FROM equipment_modifications em
  INNER JOIN equipment_items ei ON em.equipment_id = ei.id
  WHERE ei.sku = 'SCREEN-4X2.5' AND em.name = 'На стойках'
  LIMIT 1
),
tv_stand AS (
  SELECT id FROM equipment_items 
  WHERE name LIKE '%Основание%TV%' OR name LIKE '%стойк%'
  LIMIT 1
)
INSERT INTO modification_components (modification_id, component_equipment_id, quantity)
SELECT ms.id, ts.id, 4
FROM mod_stands ms, tv_stand ts
WHERE NOT EXISTS (
  SELECT 1 FROM modification_components
  WHERE modification_id = ms.id AND component_equipment_id = ts.id
)
ON CONFLICT DO NOTHING;
/*
  # Add components for suspension modification
  
  Add truss and rigging components to "В подвесе" modification
*/

WITH mod_suspend AS (
  SELECT em.id FROM equipment_modifications em
  INNER JOIN equipment_items ei ON em.equipment_id = ei.id
  WHERE ei.sku = 'SCREEN-4X2.5' AND em.name = 'В подвесе'
  LIMIT 1
),
truss AS (
  SELECT id FROM equipment_items 
  WHERE category = 'Сцена' AND name LIKE '%Ферма%K4%'
  LIMIT 1
),
rigging AS (
  SELECT id FROM equipment_items 
  WHERE category = 'Сцена' AND name LIKE '%Навершие%'
  LIMIT 1
)
INSERT INTO modification_components (modification_id, component_equipment_id, quantity)
SELECT ms.id, t.id, 2
FROM mod_suspend ms, truss t
WHERE NOT EXISTS (
  SELECT 1 FROM modification_components
  WHERE modification_id = ms.id AND component_equipment_id = t.id
)

UNION ALL

SELECT ms.id, r.id, 4
FROM mod_suspend ms, rigging r
WHERE NOT EXISTS (
  SELECT 1 FROM modification_components
  WHERE modification_id = ms.id AND component_equipment_id = r.id
);
/*
  # Fix RLS policies for equipment modifications

  1. Changes
    - Create a security definer function to check user roles safely
    - Update RLS policies for equipment_modifications to use the function
    - Update RLS policies for modification_components to use the function

  2. Security
    - Function runs with elevated privileges to bypass RLS on users table
    - Policies still enforce admin-only access for INSERT/UPDATE/DELETE operations
*/

-- Create a security definer function to check if the current user is admin
CREATE OR REPLACE FUNCTION is_admin_or_superuser()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  );
END;
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage equipment modifications" ON equipment_modifications;
DROP POLICY IF EXISTS "Admin can update equipment modifications" ON equipment_modifications;
DROP POLICY IF EXISTS "Admin can delete equipment modifications" ON equipment_modifications;
DROP POLICY IF EXISTS "Admin can manage modification components" ON modification_components;
DROP POLICY IF EXISTS "Admin can update modification components" ON modification_components;
DROP POLICY IF EXISTS "Admin can delete modification components" ON modification_components;

-- Recreate policies using the security definer function
CREATE POLICY "Admin can manage equipment modifications"
  ON equipment_modifications FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_superuser());

CREATE POLICY "Admin can update equipment modifications"
  ON equipment_modifications FOR UPDATE
  TO authenticated
  USING (is_admin_or_superuser());

CREATE POLICY "Admin can delete equipment modifications"
  ON equipment_modifications FOR DELETE
  TO authenticated
  USING (is_admin_or_superuser());

CREATE POLICY "Admin can manage modification components"
  ON modification_components FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_superuser());

CREATE POLICY "Admin can update modification components"
  ON modification_components FOR UPDATE
  TO authenticated
  USING (is_admin_or_superuser());

CREATE POLICY "Admin can delete modification components"
  ON modification_components FOR DELETE
  TO authenticated
  USING (is_admin_or_superuser());/*
  # Add warehouse specification other items table

  1. Create warehouse_specification_other table
    - For storing toolkit, clamps, straps, etc.
  
  2. Tables created:
    - `warehouse_specification_other`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key)
      - `category` (text) - Инструменталка, Clamp, Ремешки
      - `item_type` (text) - specific item name
      - `quantity` (integer)
      - `notes` (text)
      - `picked` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  3. Security
    - Enable RLS on `warehouse_specification_other`
    - Add policies for authenticated users to manage items
*/

CREATE TABLE IF NOT EXISTS warehouse_specification_other (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category text NOT NULL,
  item_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  notes text DEFAULT '',
  picked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE warehouse_specification_other ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage other items"
  ON warehouse_specification_other FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_warehouse_other_event_id ON warehouse_specification_other(event_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_other_category ON warehouse_specification_other(category);/*
  # Add picked field to warehouse specification cables and connectors

  1. Add picked boolean field to warehouse_specification_cables table
  2. Add picked boolean field to warehouse_specification_connectors table
  3. Set default value to false for existing records
*/

-- Add picked field to warehouse_specification_cables table
ALTER TABLE warehouse_specification_cables 
ADD COLUMN IF NOT EXISTS picked boolean DEFAULT false;

-- Add picked field to warehouse_specification_connectors table  
ALTER TABLE warehouse_specification_connectors
ADD COLUMN IF NOT EXISTS picked boolean DEFAULT false;

-- Update existing records to have picked = false
UPDATE warehouse_specification_cables SET picked = false WHERE picked IS NULL;
UPDATE warehouse_specification_connectors SET picked = false WHERE picked IS NULL;
/*
  # Add picked field to warehouse specification cables and connectors

/*
  # Add picked field to warehouse specification cables and connectors

  1. Add picked boolean field to warehouse_specification_cables table
  2. Add picked boolean field to warehouse_specification_connectors table
  3. Set default value to false for existing records
*/

-- Add picked field to warehouse_specification_cables table
ALTER TABLE warehouse_specification_cables 
ADD COLUMN IF NOT EXISTS picked boolean DEFAULT false;

-- Add picked field to warehouse_specification_connectors table  
ALTER TABLE warehouse_specification_connectors
ADD COLUMN IF NOT EXISTS picked boolean DEFAULT false;

-- Update existing records to have picked = false
UPDATE warehouse_specification_cables SET picked = false WHERE picked IS NULL;
UPDATE warehouse_specification_connectors SET picked = false WHERE picked IS NULL;