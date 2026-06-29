// src/app/api/vault/introductions/[id]/followup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getGmailClient, buildEmailWithAttachments, encodeMessage } from "@/lib/gmail";

const CC_EMAILS = "betty.soare@fatjoe.com, jayson.sallatic@fatjoe.com";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const id = Number(params.id);

  const reqBody = await req.json().catch(() => ({}));
  const {
    message,
    attachments,
  } = reqBody as {
    message?: string;
    attachments?: Array<{ filename: string; mimeType: string; data: string }>;
  };

  const { data: item, error } = await supabase
    .from("vault_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (!item.gmail_thread_id) {
    return NextResponse.json({ error: "No intro sent yet — send intro first" }, { status: 400 });
  }

  if (!item.partner_email) {
    return NextResponse.json({ error: "No partner email on record" }, { status: 400 });
  }

  try {
    const gmail = getGmailClient();

    const thread = await gmail.users.threads.get({
      userId: "me",
      id: item.gmail_thread_id,
      format: "metadata",
      metadataHeaders: ["Message-ID", "Subject"],
    });

    const firstMsg = thread.data.messages?.[0];
    const headers = firstMsg?.payload?.headers ?? [];
    const messageId = headers.find((h) => h.name?.toLowerCase() === "message-id")?.value;
    const originalSubject =
      headers.find((h) => h.name?.toLowerCase() === "subject")?.value ??
      `Introduction: ${item.website_url}`;

    const followUpBody =
      message ??
      `Hi,\n\nJust following up on my previous email about ${item.website_url}. Would love to connect and explore collaboration possibilities!\n\nBest regards,\nRavi`;

    const replySubject = originalSubject.startsWith("Re:")
      ? originalSubject
      : `Re: ${originalSubject}`;

    const rawEmail = buildEmailWithAttachments({
      to: item.partner_email,
      cc: CC_EMAILS,
      from: process.env.GMAIL_SENDER!,
      subject: replySubject,
      body: followUpBody,
      inReplyTo: messageId ?? undefined,
      references: messageId ?? undefined,
      attachments: attachments ?? [],
    });

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodeMessage(rawEmail),
        threadId: item.gmail_thread_id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
