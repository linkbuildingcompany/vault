// src/app/api/vault/communications/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  // Verify user with anon client + their token
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) return null;

  // Check role with service role client (bypasses RLS)
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return null;
  return serviceClient;
}

export async function GET(req: NextRequest) {
  const serviceClient = await requireAdmin(req);
  if (!serviceClient) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await serviceClient
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
  const serviceClient = await requireAdmin(req);
  if (!serviceClient) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sender_email = (body.sender_email || "").trim();
  const reviewer_1_email = (body.reviewer_1_email || "").trim();
  const reviewer_2_email = (body.reviewer_2_email || "").trim();

  const { error } = await serviceClient.from("reviewer_settings").upsert({
    id: 1,
    sender_email,
    reviewer_1_email,
    reviewer_2_email,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
