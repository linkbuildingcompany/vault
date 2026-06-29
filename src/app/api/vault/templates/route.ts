// src/app/api/vault/templates/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .in("id", ["intro", "followup"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Shape into { intro: {...}, followup: {...} }
  const templates: Record<string, { subject: string; body: string }> = {};
  for (const row of data ?? []) {
    templates[row.id] = { subject: row.subject, body: row.body };
  }

  return NextResponse.json(templates);
}

export async function PUT(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json().catch(() => ({}));
  const { id, subject, body: templateBody } = body;

  if (!id || !subject || !templateBody) {
    return NextResponse.json({ error: "id, subject, and body are required" }, { status: 400 });
  }
  if (!["intro", "followup"].includes(id)) {
    return NextResponse.json({ error: "id must be intro or followup" }, { status: 400 });
  }

  const { error } = await supabase
    .from("email_templates")
    .upsert({ id, subject, body: templateBody, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
