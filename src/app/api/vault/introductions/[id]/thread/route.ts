// src/app/api/vault/introductions/[id]/thread/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getGmailClient } from "@/lib/gmail";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const id = Number(params.id);

  const { data: item, error } = await supabase
    .from("vault_items")
    .select("gmail_thread_id")
    .eq("id", id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (!item.gmail_thread_id) {
    return NextResponse.json({ messages: [] });
  }

  try {
    const gmail = getGmailClient();
    const thread = await gmail.users.threads.get({
      userId: "me",
      id: item.gmail_thread_id,
      format: "metadata",
      metadataHeaders: ["From", "To", "Cc", "Subject", "Date"],
    });

    const messages = (thread.data.messages || []).map((msg) => {
      const headers = msg.payload?.headers || [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      return {
        id: msg.id,
        threadId: msg.threadId,
        snippet: msg.snippet,
        date: get("Date"),
        from: get("From"),
        to: get("To"),
        subject: get("Subject"),
        labelIds: msg.labelIds || [],
      };
    });

    return NextResponse.json({ messages, threadId: item.gmail_thread_id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
