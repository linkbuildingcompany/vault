// src/app/api/vault/introductions/[id]/followup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getGmailClient, buildEmail, encodeMessage } from "@/lib/gmail";

const TO_EMAIL = "betty.soare@fatjoe.com";
const CC_EMAIL = "jayson.sallatic@fatjoe.com";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  const customMessage: string | undefined = body.message;

  const { data: item, error } = await supabase
    .from("vault_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (!item.gmail_thread_id) {
    return NextResponse.json(
      { error: "No intro sent yet — send intro first" },
      { status: 400 }
    );
  }

  try {
    const gmail = getGmailClient();

    // Get the first message in the thread to get the Message-ID for In-Reply-To
    const thread = await gmail.users.threads.get({
      userId: "me",
      id: item.gmail_thread_id,
      format: "metadata",
      metadataHeaders: ["Message-ID", "Subject"],
    });

    const firstMsg = thread.data.messages?.[0];
    const headers = firstMsg?.payload?.headers || [];
    const messageId = headers.find(
      (h) => h.name?.toLowerCase() === "message-id"
    )?.value;
    const subject = headers.find(
      (h) => h.name?.toLowerCase() === "subject"
    )?.value ?? `Introduction: ${item.website_url}`;

    const followUpBody = customMessage
      ? customMessage
      : `Hi Betty,

Just following up on the introduction I sent for ${item.website_url}. Please let me know if you have any questions or would like more information!

Best regards,
Ravi`;

    const rawEmail = buildEmail({
      to: TO_EMAIL,
      cc: CC_EMAIL,
      from: process.env.GMAIL_SENDER!,
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      body: followUpBody,
      inReplyTo: messageId,
      references: messageId,
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
