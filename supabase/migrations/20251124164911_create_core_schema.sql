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
