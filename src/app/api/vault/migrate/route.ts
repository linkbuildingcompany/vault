// src/app/api/vault/migrate/route.ts
// TEMPORARY — delete after running once
import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

const MIGRATION_SECRET = "vault-migrate-2024-xk9q";

const CONFIGS = [
  {
    label: "pooler-transaction-6543",
    host: "aws-0-ap-south-1.pooler.supabase.com",
    port: 6543,
    user: "postgres.izmowncxdfudundyxjfs",
    password: "ph5gF9Pg2K99u5AEtKo$dOMG",
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  },
  {
    label: "pooler-session-5432",
    host: "aws-0-ap-south-1.pooler.supabase.com",
    port: 5432,
    user: "postgres.izmowncxdfudundyxjfs",
    password: "ph5gF9Pg2K99u5AEtKo$dOMG",
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  },
  {
    label: "direct-postgres",
    host: "db.izmowncxdfudundyxjfs.supabase.co",
    port: 5432,
    user: "postgres",
    password: "ph5gF9Pg2K99u5AEtKo$dOMG",
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  },
];

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-migration-secret");
  if (auth !== MIGRATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: any[] = [];

  for (const cfg of CONFIGS) {
    const client = new Client({ ...cfg, connectionTimeoutMillis: 8000 });
    try {
      await client.connect();

      await client.query(`
        CREATE TABLE IF NOT EXISTS website_reviews (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          domain TEXT UNIQUE NOT NULL,
          review_status TEXT NOT NULL DEFAULT 'Pending Review',
          system_status TEXT NOT NULL DEFAULT 'Not Added to System',
          date_added DATE NOT NULL DEFAULT CURRENT_DATE,
          review_comments TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS review_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          website_id UUID REFERENCES website_reviews(id) ON DELETE CASCADE,
          domain TEXT NOT NULL,
          user_email TEXT NOT NULL,
          field_changed TEXT NOT NULL,
          previous_value TEXT,
          new_value TEXT,
          changed_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await client.end();
      return NextResponse.json({ success: true, via: cfg.label });
    } catch (err: any) {
      await client.end().catch(() => {});
      results.push({ label: cfg.label, error: err.message });
    }
  }

  return NextResponse.json({ success: false, attempts: results }, { status: 500 });
}
