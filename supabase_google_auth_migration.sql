-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)

-- 1. Add Google auth columns
ALTER TABLE erp_users
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

-- 2. Make phone nullable (Google-auth admins have no phone)
ALTER TABLE erp_users ALTER COLUMN phone DROP NOT NULL;

-- 3. Make pin_hash nullable (Google-auth admins have no PIN)
ALTER TABLE erp_users ALTER COLUMN pin_hash DROP NOT NULL;
