// src/app/api/vault/communications/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function GET() {
  try {
    const { data, error } = await db.from("reviewer_settings").select("*").eq("id", 1).single();
    if (error || !data) {
      return NextResponse.json({
        sender_email: "", reviewer_1_email: "", reviewer_2_email: "",
        outreach_email_1: "", alina_email: "", alina_refresh_token: "",
      });
    }
    return NextResponse.json({
      sender_email: data.sender_email || "",
      reviewer_1_email: data.reviewer_1_email || "",
      reviewer_2_email: data.reviewer_2_email || "",
      outreach_email_1: data.outreach_email_1 || "",
      alina_email: data.alina_email || "",
      alina_refresh_token: data.alina_refresh_token || "",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const reviewer_1_email = (body.reviewer_1_email || "").trim();
    const reviewer_2_email = (body.reviewer_2_email || "").trim();
    const sender_email = (body.sender_email || "").trim();
    const outreach_email_1 = (body.outreach_email_1 || "").trim();
    const alina_email = (body.alina_email || "").trim();
    const alina_refresh_token = (body.alina_refresh_token || "").trim();

    // Build upsert payload progressively — handle columns that may not exist yet
    const payload: Record<string, unknown> = {
      id: 1, reviewer_1_email, reviewer_2_email, sender_email, outreach_email_1,
    };

    // Try adding alina fields
    let { error } = await db.from("reviewer_settings").upsert({
      ...payload, alina_email, alina_refresh_token,
    });

    if (error?.message?.includes("alina_refresh_token") || error?.message?.includes("alina_email")) {
      // Columns don't exist yet — retry without them
      const r2 = await db.from("reviewer_settings").upsert(payload);
      error = r2.error;
    }

    if (error?.message?.includes("outreach_email_1")) {
      const { id: _id, outreach_email_1: _o, ...rest } = payload as any;
      const r3 = await db.from("reviewer_settings").upsert({ id: 1, ...rest });
      error = r3.error;
    }

    if (error?.message?.includes("sender_email")) {
      const r4 = await db.from("reviewer_settings").upsert({
        id: 1, reviewer_1_email, reviewer_2_email,
      });
      error = r4.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
