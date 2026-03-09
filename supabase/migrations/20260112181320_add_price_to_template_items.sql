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
