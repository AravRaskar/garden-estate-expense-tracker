-- ============================================
-- Garden Estate Expense Tracker
-- Supabase Database Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Buildings table
CREATE TABLE IF NOT EXISTS buildings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_order INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Flats table (16 per building)
CREATE TABLE IF NOT EXISTS flats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    flat_number TEXT NOT NULL,
    display_order INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(building_id, flat_number)
);

-- 3. Donations table (one record per flat per year)
CREATE TABLE IF NOT EXISTS donations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    flat_id UUID REFERENCES flats(id) ON DELETE CASCADE,
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    year INT NOT NULL,
    owner_name TEXT DEFAULT '',
    donated BOOLEAN DEFAULT FALSE,
    amount DECIMAL(10,2) DEFAULT 0,
    transaction_type TEXT DEFAULT '',
    date_given DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(flat_id, year)
);

-- 4. Individuals table (donations not tied to any building)
CREATE TABLE IF NOT EXISTS individuals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    year INT NOT NULL,
    name TEXT NOT NULL,
    amount DECIMAL(10,2) DEFAULT 0,
    transaction_type TEXT DEFAULT '',
    date_given DATE DEFAULT CURRENT_DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    year INT NOT NULL,
    given_to TEXT NOT NULL,
    amount DECIMAL(10,2) DEFAULT 0,
    spent_on TEXT NOT NULL,
    transaction_type TEXT DEFAULT '',
    date_spent DATE DEFAULT CURRENT_DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Daily Timetable table
CREATE TABLE IF NOT EXISTS timetables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    year INT NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    event_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_donations_year ON donations(year);
CREATE INDEX IF NOT EXISTS idx_donations_building_year ON donations(building_id, year);
CREATE INDEX IF NOT EXISTS idx_flats_building ON flats(building_id);
CREATE INDEX IF NOT EXISTS idx_donations_owner ON donations(owner_name);
CREATE INDEX IF NOT EXISTS idx_individuals_year ON individuals(year);
CREATE INDEX IF NOT EXISTS idx_expenses_year ON expenses(year);
CREATE INDEX IF NOT EXISTS idx_timetables_year ON timetables(year);

-- ============================================
-- Seed Data
-- ============================================

-- Insert 9 buildings
INSERT INTO buildings (name, display_order) VALUES
    ('Mayflower', 1),
    ('Pink Rose', 2),
    ('White Rose', 3),
    ('Red Rose', 4),
    ('Lotus', 5),
    ('Blossom', 6),
    ('Orchid', 7),
    ('Sunflower', 8),
    ('Tulip', 9)
ON CONFLICT (name) DO NOTHING;

-- Insert flats: 8 flats for Tulip, 16 flats for all other buildings
DO $$
DECLARE
    b RECORD;
    max_flats INT;
    i INT;
BEGIN
    FOR b IN SELECT id, name FROM buildings ORDER BY display_order LOOP
        IF b.name = 'Tulip' THEN
            max_flats := 8;
        ELSE
            max_flats := 16;
        END IF;

        FOR i IN 1..max_flats LOOP
            INSERT INTO flats (building_id, flat_number, display_order)
            VALUES (b.id, 'Flat ' || LPAD(i::TEXT, 2, '0'), i)
            ON CONFLICT (building_id, flat_number) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE flats ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE individuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Public read buildings" ON buildings;
DROP POLICY IF EXISTS "Public read flats" ON flats;
DROP POLICY IF EXISTS "Public read donations" ON donations;
DROP POLICY IF EXISTS "Public read individuals" ON individuals;
DROP POLICY IF EXISTS "Public read expenses" ON expenses;
DROP POLICY IF EXISTS "Public read timetables" ON timetables;

DROP POLICY IF EXISTS "Public write donations" ON donations;
DROP POLICY IF EXISTS "Public write individuals" ON individuals;
DROP POLICY IF EXISTS "Public write expenses" ON expenses;
DROP POLICY IF EXISTS "Public write timetables" ON timetables;

-- Create Policies
CREATE POLICY "Public read buildings" ON buildings FOR SELECT USING (true);
CREATE POLICY "Public read flats" ON flats FOR SELECT USING (true);
CREATE POLICY "Public read donations" ON donations FOR SELECT USING (true);
CREATE POLICY "Public read individuals" ON individuals FOR SELECT USING (true);
CREATE POLICY "Public read expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Public read timetables" ON timetables FOR SELECT USING (true);

CREATE POLICY "Public write donations" ON donations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public write individuals" ON individuals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public write expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public write timetables" ON timetables FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Auto-update updated_at triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_donations_updated_at ON donations;
DROP TRIGGER IF EXISTS set_individuals_updated_at ON individuals;
DROP TRIGGER IF EXISTS set_expenses_updated_at ON expenses;

CREATE TRIGGER set_donations_updated_at BEFORE UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_individuals_updated_at BEFORE UPDATE ON individuals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
