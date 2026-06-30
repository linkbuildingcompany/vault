// src/app/api/vault/communications/threads/[threadId]/reply/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getGmailClient, buildEmail, encodeMessage } from "@/lib/gmail";

function getHeader(
  headers: { name: string; value: string }[],
  name: string
): string {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ||
    ""
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const text = (body.body || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  const { threadId } = params;

  const { data: settings } = await supabase
    .from("reviewer_settings")
    .select("reviewer_1_email, reviewer_2_email")
    .eq("id", 1)
    .single();

  const r1 = settings?.reviewer_1_email;
  const r2 = settings?.reviewer_2_email;

  if (!r1) {
    return NextResponse.json(
      { error: "Reviewer emails not configured." },
      { status: 400 }
    );
  }

  const gmail = getGmailClient();

  // Fetch thread to get reply headers
  const threadRes = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "METADATA" as "METADATA",
    metadataHeaders: ["Subject", "Message-ID", "References"],
  });

  const messages = threadRes.data.messages || [];
  const lastMsg = messages[messages.length - 1];
  const headers = (lastMsg?.payload?.headers || []) as {
    name: string;
    value: string;
  }[];

  const originalSubject = getHeader(headers, "Subject");
  const originalMsgId = getHeader(headers, "Message-ID");
  const existingRefs = getHeader(headers, "References");

  const replySubject = originalSubject.toLowerCase().startsWith("re:")
    ? originalSubject
    : `Re: ${originalSubject}`;

  const references = existingRefs
    ? `${existingRefs} ${originalMsgId}`.trim()
    : originalMsgId;

  const raw = buildEmail({
    to: r1,
    cc: r2 || undefined,
    from: "ravi.soni4254@gmail.com",
    subject: replySubject,
    body: text,
    inReplyTo: originalMsgId || undefined,
    references: references || undefined,
  });

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodeMessage(raw),
      threadId,
    },
  });

  return NextResponse.json({
    success: true,
    messageId: result.data.id,
    threadId: result.data.threadId,
  });
}
