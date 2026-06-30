// src/app/api/vault/reviews/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json();
  const { action, ids, value, userEmail, role } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
  }

  // ── DELETE ──────────────────────────────────────────────────────────────
  if (action === "delete") {
    if (role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { error } = await supabase
      .from("website_reviews")
      .delete()
      .in("id", ids);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, affected: ids.length });
  }

  // ── BULK STATUS UPDATE ───────────────────────────────────────────────────
  if (action === "update_review_status" || action === "update_system_status") {
    if (!value) {
      return NextResponse.json({ error: "Value is required" }, { status: 400 });
    }

    const field =
      action === "update_review_status" ? "review_status" : "system_status";

    // Fetch current for audit
    const { data: current } = await supabase
      .from("website_reviews")
      .select("id, domain, review_status, system_status")
      .in("id", ids);

    const { error } = await supabase
      .from("website_reviews")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    // Audit log
    if (userEmail && current && current.length > 0) {
      await supabase.from("review_audit_log").insert(
        current.map((item: Record<string, string>) => ({
          website_id: item.id,
          domain: item.domain,
          user_email: userEmail,
          field_changed: field,
          previous_value: item[field] ?? "",
          new_value: value,
        }))
      );
    }

    return NextResponse.json({ success: true, affected: ids.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
