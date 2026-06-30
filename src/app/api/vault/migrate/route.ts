// src/app/api/vault/migrate/route.ts
// TEMPORARY — delete after running once
import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

const MIGRATION_SECRET = "vault-migrate-2024-xk9q";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-migration-secret");
  if (auth !== MIGRATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = new Client({
    connectionString: `postgresql://postgres:ph5gF9Pg2K99u5AEtKo%24dOMG@db.izmowncxdfudundyxjfs.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });

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
    return NextResponse.json({ success: true, message: "Tables created successfully" });
  } catch (err: any) {
    await client.end().catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
