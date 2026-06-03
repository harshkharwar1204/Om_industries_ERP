-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Adds email and google_id fields for Google OAuth support

ALTER TABLE erp_users
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

-- After running this, update admin records with their Google email:
-- UPDATE erp_users SET email = 'your@gmail.com' WHERE phone = '8264417123';
-- UPDATE erp_users SET email = 'other@gmail.com' WHERE phone = '9574411144';

CREATE POLICY "Allow all for erp_users email update" ON erp_users
  FOR UPDATE USING (true) WITH CHECK (true);
