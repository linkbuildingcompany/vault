// src/app/api/vault/communications/threads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient } from "@/lib/gmail";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function maskSender(from: string, r1: string, r2: string): string {
  const lower = from.toLowerCase();
  if (r1 && lower.includes(r1.toLowerCase())) return "Reviewer 1";
  if (r2 && lower.includes(r2.toLowerCase())) return "Reviewer 2";
  return "You";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get("folder") || "inbox";
    const search = searchParams.get("search") || "";
    const pageToken = searchParams.get("pageToken") || undefined;

    const { data: settings } = await db
      .from("reviewer_settings")
      .select("reviewer_1_email, reviewer_2_email")
      .eq("id", 1)
      .single();

    const r1 = settings?.reviewer_1_email || "";
    const r2 = settings?.reviewer_2_email || "";

    if (!r1 && !r2) {
      return NextResponse.json({ threads: [], nextPageToken: null, configured: false });
    }

    const gmail = getGmailClient();
    const reviewerEmails = [r1, r2].filter(Boolean);

    let q = "";
    if (folder === "inbox") {
      q = `(${reviewerEmails.map((e) => `from:${e}`).join(" OR ")})`;
    } else {
      q = `(${reviewerEmails.map((e) => `to:${e}`).join(" OR ")})`;
    }
    if (search) q += ` ${search}`;

    const listRes = await gmail.users.threads.list({
      userId: "me",
      q,
      maxResults: 25,
      ...(pageToken ? { pageToken } : {}),
    });

    const items = listRes.data.threads || [];
    const nextPageToken = listRes.data.nextPageToken || null;

    if (items.length === 0) {
      return NextResponse.json({ threads: [], nextPageToken, configured: true });
    }

    const threads = await Promise.all(
      items.map(async (item) => {
        try {
          const res = await gmail.users.threads.get({
            userId: "me",
            id: item.id!,
            format: "METADATA" as "METADATA",
            metadataHeaders: ["Subject", "From", "To", "Date", "Message-ID"],
          });
          const messages = res.data.messages || [];
          if (!messages.length) return null;
          const firstMsg = messages[0];
          const lastMsg = messages[messages.length - 1];
          const firstHeaders = (firstMsg.payload?.headers || []) as { name: string; value: string }[];
          const lastHeaders = (lastMsg.payload?.headers || []) as { name: string; value: string }[];
          const subject = getHeader(firstHeaders, "Subject") || "(no subject)";
          const from = getHeader(lastHeaders, "From");
          const sender = maskSender(from, r1, r2);
          const date = lastMsg.internalDate ? new Date(parseInt(lastMsg.internalDate)).toISOString() : "";
          const hasUnread = messages.some((m) => (m.labelIds || []).includes("UNREAD"));
          return { id: item.id, subject, snippet: item.snippet || "", date, sender, messageCount: messages.length, hasUnread };
        } catch {
          return null;
        }
      })
    );

    return NextResponse.json({ threads: threads.filter(Boolean), nextPageToken, configured: true });
  } catch (err: any) {
    console.error("Threads error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
