-- Align the data model with the Ganeshotsav 2026 workbook.
-- Run once in Supabase Dashboard > SQL Editor before importing that workbook.

-- The workbook labels this building "May Flower". Preserve its existing ID,
-- flats, and donations while bringing the database name into alignment.
UPDATE buildings
SET name = 'May Flower'
WHERE name = 'Mayflower'
  AND NOT EXISTS (
    SELECT 1 FROM buildings WHERE name = 'May Flower'
  );

-- The workbook records purpose, amount, payment mode, and date, but not every
-- expense has a recipient. Store that absence as NULL instead of inventing one.
ALTER TABLE expenses
    ALTER COLUMN given_to DROP NOT NULL;

-- Stable import keys make repeated imports update the same rows, not duplicate them.
ALTER TABLE individuals
    ADD COLUMN IF NOT EXISTS import_key TEXT;

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS import_key TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'individuals_import_key_unique'
    ) THEN
        ALTER TABLE individuals
            ADD CONSTRAINT individuals_import_key_unique UNIQUE (import_key);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'expenses_import_key_unique'
    ) THEN
        ALTER TABLE expenses
            ADD CONSTRAINT expenses_import_key_unique UNIQUE (import_key);
    END IF;
END $$;
