import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("vault_items")
    .update({ introduced_at: new Date().toISOString() })
    .eq("id", Number(params.id));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
