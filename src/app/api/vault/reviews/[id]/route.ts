// src/app/api/vault/reviews/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const body = await req.json();
  const { id } = params;

  const newStatus = body.review_status as string | undefined;
  if (newStatus === "Rejected" || newStatus === "Needs Changes") {
    const comments = body.review_comments !== undefined ? body.review_comments : undefined;
    if (comments !== undefined && !String(comments).trim()) {
      return NextResponse.json(
        { error: `Review comments are required when status is "${newStatus}"` },
        { status: 400 }
      );
    }
  }

  const { data: current } = await supabase
    .from("website_reviews")
    .select("*")
    .eq("id", id)
    .single();

  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const effectiveStatus = newStatus ?? current.review_status;
  const effectiveComments =
    body.review_comments !== undefined
      ? String(body.review_comments).trim()
      : String(current.review_comments ?? "").trim();

  if (
    (effectiveStatus === "Rejected" || effectiveStatus === "Needs Changes") &&
    !effectiveComments
  ) {
    return NextResponse.json(
      { error: `Review comments are required for "${effectiveStatus}" status` },
      { status: 400 }
    );
  }

  const trackable = [
    "review_status",
    "system_status",
    "review_comments",
    "domain",
    "site_type",
  ] as const;

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const auditEntries: { field: string; prev: string; next: string }[] = [];

  for (const field of trackable) {
    if (body[field] !== undefined && body[field] !== current[field]) {
      updates[field] = body[field];
      auditEntries.push({
        field,
        prev: current[field] ?? "",
        next: body[field],
      });
    }
  }

  if (auditEntries.length === 0) {
    return NextResponse.json(current);
  }

  const { data, error } = await supabase
    .from("website_reviews")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.userEmail && auditEntries.length > 0) {
    await supabase.from("review_audit_log").insert(
      auditEntries.map((e) => ({
        website_id: id,
        domain: current.domain,
        user_email: body.userEmail,
        field_changed: e.field,
        previous_value: e.prev,
        new_value: e.next,
      }))
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const { id } = params;

  const { error } = await supabase
    .from("website_reviews")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
