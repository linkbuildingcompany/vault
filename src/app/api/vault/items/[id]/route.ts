// src/app/api/vault/items/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// PATCH /api/vault/items/[id]
// Body: { accepted?: "pending"|"Y"|"N", added_to_system?: boolean }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const id = Number(params.id);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if ("accepted" in body) updates.accepted = body.accepted;
  if ("added_to_system" in body) updates.added_to_system = body.added_to_system;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vault_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
