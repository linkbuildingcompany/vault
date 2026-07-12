// src/app/api/vault/communications/threads/[threadId]/reply/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient, buildEmail, encodeMessage } from "@/lib/gmail";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

export async function POST(req: NextRequest, { params }: { params: { threadId: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = (body.body || "").trim();
    const type = (body.type || "reviewer") as "reviewer" | "outreach";
    if (!text) return NextResponse.json({ error: "Body is required" }, { status: 400 });

    const { threadId } = params;

    const { data: settings } = await db
      .from("reviewer_settings")
      .select("*")
      .eq("id", 1)
      .single();

    const senderEmail = settings?.sender_email || "ravi.soni4254@gmail.com";
    const r1 = settings?.reviewer_1_email || "";
    const r2 = settings?.reviewer_2_email || "";
    const outreach1 = settings?.outreach_email_1 || "";

    const gmail = getGmailClient();
    const threadRes = await gmail.users.threads.get({
      userId: "me", id: threadId, format: "METADATA" as "METADATA",
      metadataHeaders: ["Subject", "Message-ID", "References", "To", "From"],
    });

    const messages = threadRes.data.messages || [];
    const lastMsg = messages[messages.length - 1];
    const firstMsg = messages[0];
    const lastHeaders = (lastMsg?.payload?.headers || []) as { name: string; value: string }[];
    const firstHeaders = (firstMsg?.payload?.headers || []) as { name: string; value: string }[];

    const originalSubject = getHeader(firstHeaders, "Subject");
    const originalMsgId = getHeader(lastMsg?.payload?.headers as any || [], "Message-ID");
    const existingRefs = getHeader(lastHeaders, "References");
    const replySubject = originalSubject.toLowerCase().startsWith("re:") ? originalSubject : `Re: ${originalSubject}`;
    const references = existingRefs ? `${existingRefs} ${originalMsgId}`.trim() : originalMsgId;

    let toEmail: string;
    let ccEmail: string | undefined;

    if (type === "outreach") {
      // Reply to the original partner email (from the first message's To header)
      const firstTo = getHeader(firstHeaders, "To");
      // Extract raw email address if display name is present
      const match = firstTo.match(/[\w.+-]+@[\w.+-]+\.\w+/);
      toEmail = match ? match[0] : firstTo;
      ccEmail = outreach1 || undefined;
    } else {
      if (!r1) return NextResponse.json({ error: "Reviewer emails not configured." }, { status: 400 });
      toEmail = r1;
      ccEmail = r2 || undefined;
    }

    const raw = buildEmail({
      to: toEmail,
      cc: ccEmail,
      from: senderEmail,
      subject: replySubject,
      body: text,
      inReplyTo: originalMsgId || undefined,
      references: references || undefined,
    });

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodeMessage(raw), threadId },
    });

    return NextResponse.json({ success: true, messageId: result.data.id, threadId: result.data.threadId });
  } catch (err: any) {
    console.error("Reply error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
