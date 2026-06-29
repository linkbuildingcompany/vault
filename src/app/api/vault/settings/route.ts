import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const settings: Record<string, string> = {};
  for (const row of data ?? []) settings[row.key] = row.value;
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const supabase = createServerClient();
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    await supabase.from("app_settings").upsert({ key, value });
  }
  return NextResponse.json({ success: true });
}
