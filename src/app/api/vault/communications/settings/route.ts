// src/app/api/vault/communications/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Service role key is optional — used when available for bypassing RLS
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  // Verify user with their JWT
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;

  // Check profile role — try service client first, fall back to user client
  const dbClient = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : userClient;

  const { data: profile } = await dbClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return null;

  // Return service client for DB writes (bypasses RLS), or user client
  return supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : userClient;
}

export async function GET(req: NextRequest) {
  try {
    const dbClient = await requireAdmin(req);
    if (!dbClient) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await dbClient
      .from("reviewer_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error || !data) {
      return NextResponse.json({ sender_email: "", reviewer_1_email: "", reviewer_2_email: "" });
    }

    return NextResponse.json({
      sender_email: data.sender_email || "",
      reviewer_1_email: data.reviewer_1_email || "",
      reviewer_2_email: data.reviewer_2_email || "",
    });
  } catch (err: any) {
    console.error("Settings GET error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const dbClient = await requireAdmin(req);
    if (!dbClient) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const reviewer_1_email = (body.reviewer_1_email || "").trim();
    const reviewer_2_email = (body.reviewer_2_email || "").trim();
    const sender_email = (body.sender_email || "").trim();

    // Build upsert payload — include sender_email only if column likely exists
    // We'll try with it first, fall back without it if column missing
    const payload: any = {
      id: 1,
      reviewer_1_email,
      reviewer_2_email,
      updated_at: new Date().toISOString(),
    };

    // Try with sender_email first
    let { error } = await dbClient
      .from("reviewer_settings")
      .upsert({ ...payload, sender_email });

    // If sender_email column doesn't exist, retry without it
    if (error && error.message?.includes("sender_email")) {
      const result = await dbClient
        .from("reviewer_settings")
        .upsert(payload);
      error = result.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Settings PUT error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
