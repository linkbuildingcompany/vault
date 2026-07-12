// src/app/api/vault/communications/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient, buildEmailWithAttachments, encodeMessage } from "@/lib/gmail";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const subject = (body.subject || "").trim();
    const text = (body.body || "").trim();
    const type = (body.type || "reviewer") as "reviewer" | "outreach";
    const partnerEmail = (body.partner_email || "").trim(); // outreach only
    const attachments: Array<{ filename: string; mimeType: string; data: string }> = body.attachments || [];

    if (!subject || !text) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
    }

    const { data: settings, error: settingsError } = await db
      .from("reviewer_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsError) console.error("Settings fetch error:", settingsError.message);

    const senderEmail = settings?.sender_email || "ravi.soni4254@gmail.com";
    const r1 = settings?.reviewer_1_email || "";
    const r2 = settings?.reviewer_2_email || "";
    const outreach1 = settings?.outreach_email_1 || "";

    const gmail = getGmailClient();
    let raw: string;

    if (type === "outreach") {
      if (!partnerEmail) {
        return NextResponse.json({ error: "Partner email is required for outreach." }, { status: 400 });
      }
      if (!outreach1) {
        return NextResponse.json({ error: "Outreach Email 1 not configured. Please set it in Settings." }, { status: 400 });
      }
      raw = buildEmailWithAttachments({ to: partnerEmail, cc: outreach1, from: senderEmail, subject, body: text, attachments });
    } else {
      // Reviewer notification
      if (!r1) {
        return NextResponse.json({ error: "Reviewer 1 email not configured. Please set it in Settings." }, { status: 400 });
      }
      raw = buildEmailWithAttachments({ to: r1, cc: r2 || undefined, from: senderEmail, subject, body: text, attachments });
    }

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodeMessage(raw) },
    });

    return NextResponse.json({ success: true, messageId: result.data.id, threadId: result.data.threadId });
  } catch (err: any) {
    console.error("Send error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
