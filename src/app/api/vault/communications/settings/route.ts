// src/app/api/vault/communications/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

async function requireAdmin() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, supabase };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { user: null, supabase };
  return { user, supabase };
}

export async function GET(_req: NextRequest) {
  const { user, supabase } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("reviewer_settings")
    .select("sender_email, reviewer_1_email, reviewer_2_email")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return NextResponse.json({ sender_email: "", reviewer_1_email: "", reviewer_2_email: "" });
  }
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const { user, supabase } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sender_email = (body.sender_email || "").trim();
  const reviewer_1_email = (body.reviewer_1_email || "").trim();
  const reviewer_2_email = (body.reviewer_2_email || "").trim();

  const { error } = await supabase.from("reviewer_settings").upsert({
    id: 1,
    sender_email,
    reviewer_1_email,
    reviewer_2_email,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
