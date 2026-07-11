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
      return NextResponse.json({ sender_email: "", reviewer_1_email: "", reviewer_2_email: "" });
    }
    return NextResponse.json({
      sender_email: data.sender_email || "",
      reviewer_1_email: data.reviewer_1_email || "",
      reviewer_2_email: data.reviewer_2_email || "",
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

    // Try with sender_email first; fall back without it if column missing
    let { error } = await db.from("reviewer_settings").upsert({
      id: 1, reviewer_1_email, reviewer_2_email, sender_email,
    });
    if (error?.message?.includes("sender_email")) {
      const result = await db.from("reviewer_settings").upsert({
        id: 1, reviewer_1_email, reviewer_2_email,
      });
      error = result.error;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
