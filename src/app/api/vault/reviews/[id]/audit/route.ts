// src/app/api/vault/reviews/[id]/audit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const { id } = params;

  const { data, error } = await supabase
    .from("review_audit_log")
    .select("*")
    .eq("website_id", id)
    .order("changed_at", { ascending: false })
    .limit(200);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
