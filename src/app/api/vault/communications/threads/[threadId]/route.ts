// src/app/api/vault/communications/threads/[threadId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getGmailClient, extractBody } from "@/lib/gmail";

function getHeader(
  headers: { name: string; value: string }[],
  name: string
): string {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ||
    ""
  );
}

function maskSender(from: string, r1: string, r2: string): string {
  const lower = from.toLowerCase();
  if (r1 && lower.includes(r1.toLowerCase())) return "Reviewer 1";
  if (r2 && lower.includes(r2.toLowerCase())) return "Reviewer 2";
  return "You";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = params;

  const { data: settings } = await supabase
    .from("reviewer_settings")
    .select("reviewer_1_email, reviewer_2_email")
    .eq("id", 1)
    .single();

  const r1 = settings?.reviewer_1_email || "";
  const r2 = settings?.reviewer_2_email || "";

  const gmail = getGmailClient();

  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "FULL" as "FULL",
  });

  const messages = (res.data.messages || []).map((msg) => {
    const headers = (msg.payload?.headers || []) as {
      name: string;
      value: string;
    }[];
    const from = getHeader(headers, "From");
    const messageId = getHeader(headers, "Message-ID");
    const references = getHeader(headers, "References");
    const subject = getHeader(headers, "Subject");
    const date = msg.internalDate
      ? new Date(parseInt(msg.internalDate)).toISOString()
      : "";

    return {
      id: msg.id,
      messageId,
      references,
      subject,
      sender: maskSender(from, r1, r2),
      date,
      body: extractBody(msg.payload),
    };
  });

  // Mark thread as read (non-critical)
  try {
    await gmail.users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
  } catch { /* ignore */ }

  const subject =
    messages[0]?.subject ||
    (res.data.messages?.[0]?.snippet ?? "(no subject)");

  return NextResponse.json({ threadId, subject, messages });
}
