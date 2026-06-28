import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// DELETE /api/vault/items/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("vault_items")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
