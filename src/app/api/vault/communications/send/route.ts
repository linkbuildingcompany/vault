// src/app/api/vault/communications/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient, buildEmail, encodeMessage } from "@/lib/gmail";

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

    if (!subject || !text) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
    }

    // Use select("*") so a missing sender_email column doesn't kill the whole query
    const { data: settings, error: settingsError } = await db
      .from("reviewer_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsError) {
      console.error("Settings fetch error:", settingsError.message);
    }

    const senderEmail = settings?.sender_email || "ravi.soni4254@gmail.com";
    const r1 = settings?.reviewer_1_email;
    const r2 = settings?.reviewer_2_email;

    if (!r1) {
      return NextResponse.json(
        { error: "Reviewer 1 email not configured. Please set it in Settings." },
        { status: 400 }
      );
    }

    const gmail = getGmailClient();
    const raw = buildEmail({ to: r1, cc: r2 || undefined, from: senderEmail, subject, body: text });

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
