// src/app/api/vault/introductions/[id]/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getGmailClient, buildEmail, encodeMessage } from "@/lib/gmail";

const TO_EMAIL = "betty.soare@fatjoe.com";
const CC_EMAIL = "jayson.sallatic@fatjoe.com";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const id = Number(params.id);

  // Fetch the vault item
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
  const subject = `Introduction: ${domain}`;
  const body = `Hi Betty,

I wanted to introduce you to ${domain} — they have a great audience and I think they'd be a fantastic fit for a collaboration.

Please let me know if you'd like to connect!

Best regards,
Ravi`;

  try {
    const gmail = getGmailClient();
    const rawEmail = buildEmail({
      to: TO_EMAIL,
      cc: CC_EMAIL,
      from: process.env.GMAIL_SENDER!,
      subject,
      body,
    });

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodeMessage(rawEmail) },
    });

    const threadId = res.data.threadId!;

    // Store thread ID and mark as introduced
    await supabase
      .from("vault_items")
      .update({
        gmail_thread_id: threadId,
        introduced_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ success: true, threadId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
