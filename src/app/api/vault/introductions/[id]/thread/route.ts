// src/app/api/vault/introductions/[id]/thread/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getGmailClient, extractBody } from "@/lib/gmail";

type GmailHeader = { name?: string | null; value?: string | null };
type GmailPart = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { data?: string | null; attachmentId?: string | null; size?: number | null } | null;
  parts?: GmailPart[] | null;
  headers?: GmailHeader[] | null;
};
type GmailMessage = {
  id?: string | null;
  threadId?: string | null;
  snippet?: string | null;
  labelIds?: string[] | null;
  payload?: {
    headers?: GmailHeader[] | null;
    body?: { data?: string | null } | null;
    parts?: GmailPart[] | null;
    mimeType?: string | null;
  } | null;
  internalDate?: string | null;
};

const listAttachments = (
  parts: GmailPart[]
): Array<{ filename: string; mimeType: string; attachmentId: string }> => {
  const result: Array<{ filename: string; mimeType: string; attachmentId: string }> = [];
  for (const part of parts) {
    if (part.filename && part.body?.attachmentId) {
      result.push({
        filename: part.filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        attachmentId: part.body.attachmentId,
      });
    }
    if (part.parts) {
      result.push(...listAttachments(part.parts));
    }
  }
  return result;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const id = Number(params.id);

  const { data: item, error } = await supabase
    .from("vault_items")
    .select("gmail_thread_id, partner_email")
    .eq("id", id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (!item.gmail_thread_id) {
    return NextResponse.json({ messages: [], threadId: null });
  }

  try {
    const gmail = getGmailClient();
    const senderEmail = process.env.GMAIL_SENDER ?? "";

    const thread = await gmail.users.threads.get({
      userId: "me",
      id: item.gmail_thread_id,
      format: "full",
    });

    const messages = ((thread.data.messages ?? []) as GmailMessage[]).map((msg) => {
      const headers = (msg.payload?.headers ?? []) as GmailHeader[];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const body = extractBody(msg.payload as Parameters<typeof extractBody>[0]);
      const attachments = listAttachments((msg.payload?.parts ?? []) as GmailPart[]);

      const fromHeader = get("From");
      const isOutbound =
        fromHeader.includes(senderEmail) ||
        fromHeader.toLowerCase().includes("ravi");

      const dateMs = msg.internalDate ? Number(msg.internalDate) : 0;

      return {
        id: msg.id ?? "",
        threadId: msg.threadId ?? "",
        snippet: msg.snippet ?? "",
        date: get("Date"),
        dateMs,
        from: get("From"),
        to: get("To"),
        cc: get("Cc"),
        subject: get("Subject"),
        body,
        isOutbound,
        attachments,
        labelIds: msg.labelIds ?? [],
      };
    });

    messages.sort((a, b) => a.dateMs - b.dateMs);

    return NextResponse.json({
      messages,
      threadId: item.gmail_thread_id,
      partnerEmail: item.partner_email ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
