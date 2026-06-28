import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// PATCH /api/vault/items/:id/status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const body = await req.json();
  const accepted = body.accepted;

  if (!["Y", "N", "pending"].includes(accepted)) {
    return NextResponse.json({ error: "Invalid accepted value" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vault_items")
    .update({ accepted })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
