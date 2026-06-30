// src/app/api/vault/communications/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getGmailClient, buildEmail, encodeMessage } from "@/lib/gmail";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Require admin to send
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const subject = (body.subject || "").trim();
  const text = (body.body || "").trim();

  if (!subject || !text) {
    return NextResponse.json(
      { error: "Subject and body are required" },
      { status: 400 }
    );
  }

  const { data: settings } = await supabase
    .from("reviewer_settings")
    .select("reviewer_1_email, reviewer_2_email")
    .eq("id", 1)
    .single();

  const r1 = settings?.reviewer_1_email;
  const r2 = settings?.reviewer_2_email;

  if (!r1) {
    return NextResponse.json(
      { error: "Reviewer emails not configured. Please set them in Settings." },
      { status: 400 }
    );
  }

  const gmail = getGmailClient();

  const raw = buildEmail({
    to: r1,
    cc: r2 || undefined,
    from: "ravi.soni4254@gmail.com",
    subject,
    body: text,
  });

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodeMessage(raw) },
  });

  return NextResponse.json({
    success: true,
    messageId: result.data.id,
    threadId: result.data.threadId,
  });
}
