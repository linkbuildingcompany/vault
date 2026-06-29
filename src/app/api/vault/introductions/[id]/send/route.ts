// src/app/api/vault/introductions/[id]/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getGmailClient, buildEmailWithAttachments, encodeMessage } from "@/lib/gmail";

// FatJoe team always CC'd
const CC_EMAILS = "betty.soare@fatjoe.com, jayson.sallatic@fatjoe.com";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const id = Number(params.id);

  const reqBody = await req.json().catch(() => ({}));
  const {
    to,          // partner site email — required
    subject,
    body,
    attachments, // Array<{ filename: string; mimeType: string; data: string /* base64 */ }>
  } = reqBody as {
    to?: string;
    subject?: string;
    body?: string;
    attachments?: Array<{ filename: string; mimeType: string; data: string }>;
  };

  if (!to) {
    return NextResponse.json({ error: "Partner email (to) is required" }, { status: 400 });
  }

  const { data: item, error } = await supabase
    .from("vault_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (item.gmail_thread_id) {
    return NextResponse.json({ error: "Intro already sent" }, { status: 409 });
  }

  const domain = item.website_url;
  const emailSubject = subject ?? `Introduction: ${domain}`;
  const emailBody =
    body ??
    `Hi,\n\nI wanted to reach out about ${domain}. We'd love to explore a collaboration opportunity with you.\n\nPlease let me know if you're interested!\n\nBest regards,\nRavi`;

  try {
    const gmail = getGmailClient();
    const rawEmail = buildEmailWithAttachments({
      to,
      cc: CC_EMAILS,
      from: process.env.GMAIL_SENDER!,
      subject: emailSubject,
      body: emailBody,
      attachments: attachments ?? [],
    });

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodeMessage(rawEmail) },
    });

    const threadId = res.data.threadId!;

    await supabase
      .from("vault_items")
      .update({
        gmail_thread_id: threadId,
        introduced_at: new Date().toISOString(),
        partner_email: to,
      })
      .eq("id", id);

    return NextResponse.json({ success: true, threadId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
