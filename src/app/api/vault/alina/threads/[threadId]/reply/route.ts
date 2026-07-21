// src/app/api/vault/alina/threads/[threadId]/reply/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { encodeMessage, buildEmail, extractBody } from "@/lib/gmail";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

function getAlinaGmailClient(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

export async function POST(req: NextRequest, { params }: { params: { threadId: string } }) {
  try {
    const { threadId } = params;
    const body = await req.json().catch(() => ({}));
    const replyBody = (body.body || "").trim();

    if (!replyBody) {
      return NextResponse.json({ error: "Reply body is required" }, { status: 400 });
    }

    const { data: settings } = await db
      .from("reviewer_settings")
      .select("*")
      .eq("id", 1)
      .single();

    const alinaEmail = settings?.alina_email || "alina@rehiring.net";
    const alinaToken = settings?.alina_refresh_token || "";

    if (!alinaToken) {
      return NextResponse.json({ error: "Alina account not configured" }, { status: 503 });
    }

    const gmail = getAlinaGmailClient(alinaToken);

    // Get thread to find reply-to info
    const threadRes = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "FULL" as "FULL",
    });

    const messages = threadRes.data.messages || [];
    if (!messages.length) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const lastMsg = messages[messages.length - 1];
    const headers = (lastMsg.payload?.headers || []) as { name: string; value: string }[];
    const lastFrom = getHeader(headers, "From");
    const lastTo = getHeader(headers, "To");
    const lastReplyTo = getHeader(headers, "Reply-To");
    const subject = getHeader(headers, "Subject");
    const messageId = getHeader(headers, "Message-ID");
    const references = getHeader(headers, "References");

    // Reply TO the person who sent the last message (if not us, reply to them; if we sent last, reply to original sender)
    const lastFromLower = lastFrom.toLowerCase();
    let replyTo: string;
    if (lastFromLower.includes(alinaEmail.toLowerCase())) {
      // We sent last — reply to original thread starter
      const firstMsg = messages[0];
      const firstHeaders = (firstMsg.payload?.headers || []) as { name: string; value: string }[];
      replyTo = getHeader(firstHeaders, "From");
    } else {
      replyTo = lastReplyTo || lastFrom;
    }

    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
    const newRefs = references ? `${references} ${messageId}` : messageId;

    const raw = buildEmail({
      from: alinaEmail,
      to: replyTo,
      subject: replySubject,
      body: replyBody,
      inReplyTo: messageId,
      references: newRefs,
    });

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodeMessage(raw),
        threadId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Alina reply error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
