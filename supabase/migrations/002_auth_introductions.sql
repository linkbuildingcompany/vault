-- Add introduced_at column to vault_items
ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS introduced_at TIMESTAMPTZ;

-- Profiles table (links to Supabase auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default from-email setting
INSERT INTO app_settings (key, value)
VALUES ('intro_from_email', 'ravi.soni4254@gmail.com')
ON CONFLICT (key) DO NOTHING;

-- Disable RLS on new tables
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
