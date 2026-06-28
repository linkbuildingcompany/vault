-- Create vault_items table
CREATE TABLE IF NOT EXISTS vault_items (
    id BIGSERIAL PRIMARY KEY,
    website_url TEXT NOT NULL UNIQUE,
    accepted TEXT NOT NULL DEFAULT 'pending',  -- values: 'pending', 'Y', 'N'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast month filtering
CREATE INDEX IF NOT EXISTS idx_vault_items_created_at ON vault_items (created_at DESC);

-- Index for domain search
CREATE INDEX IF NOT EXISTS idx_vault_items_url ON vault_items (website_url);

-- Disable RLS for now (no auth required per spec)
ALTER TABLE vault_items DISABLE ROW LEVEL SECURITY;
