// src/app/api/vault/migrate/route.ts
// TEMPORARY — delete after running once
import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

const MIGRATION_SECRET = "vault-migrate-2024-xk9q";

const SQL_TABLES = `
  CREATE TABLE IF NOT EXISTS website_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT UNIQUE NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'Pending Review',
    system_status TEXT NOT NULL DEFAULT 'Not Added to System',
    date_added DATE NOT NULL DEFAULT CURRENT_DATE,
    review_comments TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS review_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID REFERENCES website_reviews(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    user_email TEXT NOT NULL,
    field_changed TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

const CONFIGS = [
  // Pooler transaction mode with plain postgres user
  { label: "pooler-tx-plain", host: "aws-0-ap-south-1.pooler.supabase.com", port: 6543, user: "postgres", password: "ph5gF9Pg2K99u5AEtKo$dOMG", database: "postgres", ssl: { rejectUnauthorized: false } },
  // Pooler session mode with plain postgres user  
  { label: "pooler-sess-plain", host: "aws-0-ap-south-1.pooler.supabase.com", port: 5432, user: "postgres", password: "ph5gF9Pg2K99u5AEtKo$dOMG", database: "postgres", ssl: { rejectUnauthorized: false } },
  // Pooler transaction with project ref in user
  { label: "pooler-tx-ref", host: "aws-0-ap-south-1.pooler.supabase.com", port: 6543, user: "postgres.izmowncxdfudundyxjfs", password: "ph5gF9Pg2K99u5AEtKo$dOMG", database: "postgres", ssl: { rejectUnauthorized: false } },
  // Direct without SSL
  { label: "direct-no-ssl", host: "db.izmowncxdfudundyxjfs.supabase.co", port: 5432, user: "postgres", password: "ph5gF9Pg2K99u5AEtKo$dOMG", database: "postgres" },
  // Direct with SSL
  { label: "direct-ssl", host: "db.izmowncxdfudundyxjfs.supabase.co", port: 5432, user: "postgres", password: "ph5gF9Pg2K99u5AEtKo$dOMG", database: "postgres", ssl: { rejectUnauthorized: false } },
];

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-migration-secret");
  if (auth !== MIGRATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: any[] = [];

  for (const cfg of CONFIGS) {
    const client = new Client({ ...cfg, connectionTimeoutMillis: 10000 });
    try {
      await client.connect();
      await client.query(SQL_TABLES);
      await client.end();
      return NextResponse.json({ success: true, via: cfg.label });
    } catch (err: any) {
      await client.end().catch(() => {});
      results.push({ label: cfg.label, error: err.message });
    }
  }

  return NextResponse.json({ success: false, attempts: results }, { status: 500 });
}
