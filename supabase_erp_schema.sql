-- ============================================================
-- OM INDUSTRIES ERP — Phase 1: Hanks Unit Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. erp_users (All users — Admins + Workers, unified phone+PIN auth)
CREATE TABLE IF NOT EXISTS erp_users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'hanks_worker', 'coning_worker', 'dyeing_master')),
    department TEXT CHECK (department IN ('hanks', 'coning', 'dyeing')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. clients (Party master for autocomplete)
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. qualities (Yarn quality/count with rate matrix)
CREATE TABLE IF NOT EXISTS qualities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    hanks_rate_per_kg NUMERIC(10,2) DEFAULT 0,
    coning_rate_per_kg NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. stock_inward (Raw yarn arrivals at Unit 2)
CREATE TABLE IF NOT EXISTS stock_inward (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    challan_no TEXT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    quality_id INTEGER NOT NULL REFERENCES qualities(id) ON DELETE RESTRICT,
    weight_kg NUMERIC(10,2) NOT NULL,
    bundles INTEGER,
    remaining_weight_kg NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. hanks_production (Worker daily production entries)
CREATE TABLE IF NOT EXISTS hanks_production (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES erp_users(id) ON DELETE RESTRICT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    quality_id INTEGER NOT NULL REFERENCES qualities(id) ON DELETE RESTRICT,
    stock_inward_id INTEGER REFERENCES stock_inward(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight_kg NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rate_per_kg NUMERIC(10,2),
    total_earned NUMERIC(10,2),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. worker_advances (Salary advance requests)
CREATE TABLE IF NOT EXISTS worker_advances (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES erp_users(id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    note TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. sessions (JWT session tracking)
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES erp_users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_hanks_production_worker ON hanks_production(worker_id);
CREATE INDEX IF NOT EXISTS idx_hanks_production_date ON hanks_production(date);
CREATE INDEX IF NOT EXISTS idx_hanks_production_status ON hanks_production(status);
CREATE INDEX IF NOT EXISTS idx_stock_inward_client ON stock_inward(client_id);
CREATE INDEX IF NOT EXISTS idx_stock_inward_quality ON stock_inward(quality_id);
CREATE INDEX IF NOT EXISTS idx_worker_advances_worker ON worker_advances(worker_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- ============================================================
-- RLS Policies (disable for now, auth handled at API layer)
-- ============================================================
ALTER TABLE erp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualities ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_inward ENABLE ROW LEVEL SECURITY;
ALTER TABLE hanks_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Allow all operations via service role (our Express server uses anon key, 
-- so we create permissive policies for now)
CREATE POLICY "Allow all for erp_users" ON erp_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for qualities" ON qualities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for stock_inward" ON stock_inward FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for hanks_production" ON hanks_production FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for worker_advances" ON worker_advances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
