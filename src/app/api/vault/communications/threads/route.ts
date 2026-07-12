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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitize(text: string): string {
  if (!text) return text;

  // 1. Blocked email addresses
  const blockedEmails = [
    "betty.soare@fatjoe.com",
    "jayson.sallatic@fatjoe.com",
    "valme.claro@fatjoe.com",
    "ravi@linkbuilding.company",
  ];
  for (const email of blockedEmails) {
    text = text.replace(new RegExp(escapeRegex(email), "gi"), "[redacted]");
  }

  // 2. Any @fatjoe.com address
  text = text.replace(/[\w.+-]+@fatjoe\.com/gi, "[redacted]");

  // 3. FatJoe brand mentions
  text = text.replace(/fat\s*joe/gi, "[redacted]");

  // 4. linkbuilding.company domain + phrase
  text = text.replace(/ravi@linkbuilding\.company/gi, "[redacted]");
  text = text.replace(/linkbuilding\.company/gi, "[redacted]");
  text = text.replace(/link\s+building\s+company/gi, "[redacted]");

  // 5. Social media profile URLs (with and without protocol)
  text = text.replace(
    /https?:\/\/(www\.)?(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|t\.co|fb\.com|fb\.me|lnkd\.in|bit\.ly|ow\.ly|buff\.ly)\/\S*/gi,
    "[redacted]"
  );
  text = text.replace(
    /(^|\s)(www\.)?(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|lnkd\.in)\/\S*/gim,
    " [redacted]"
  );

  // 6. Social @handles in signatures
  text = text.replace(/(^|\s)@[A-Za-z0-9_]{2,}/gm, (m, prefix) => prefix + "[redacted]");

  // 7. Job title lines (short standalone lines with title keywords)
  const titleKeywords = [
    "manager", "director", "specialist", "executive", "coordinator",
    "analyst", "consultant", "strategist", "associate", "representative",
    "head of", "vp ", "vice president", "ceo", "coo", "cto", "cfo",
    "founder", "co-founder", "partner", "lead", "officer", "editor",
    "writer", "producer", "outreach", "seo", "sem", "content", "marketing",
    "account manager", "project manager", "team lead", "link builder",
    "link building", "pr specialist", "digital marketing",
  ];
  const titlePattern = new RegExp(
    `^[^\\n]{0,60}(${titleKeywords.map(escapeRegex).join("|")})[^\\n]{0,60}$`,
    "gim"
  );
  text = text.replace(titlePattern, "[redacted]");

  // 8. Strip dirty signature blocks
  text = stripDirtySignature(text);

  // 9. Collapse multiple consecutive [redacted] lines
  text = text.replace(/(\[redacted\]\s*\n){2,}/g, "[redacted]\n");

  return text;
}

function stripDirtySignature(text: string): string {
  const sigPattern = /(\r?\n[ \t]*)(-{2,}|Best regards|Kind regards|Warm regards|Thanks,|Thank you,|Regards,|Cheers,|Sincerely,|With regards,)/i;
  const match = sigPattern.exec(text);
  if (!match) return text;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index);
  if (after.includes("[redacted]")) return before.trimEnd();
  return text;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
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

    const parts = reviewerEmails.flatMap((e) => [`to:${e}`, `from:${e}`]);
    let q = `(${parts.join(" OR ")})`;
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
          const subject = sanitize(getHeader(firstHeaders, "Subject") || "(no subject)");
          const from = getHeader(lastHeaders, "From");
          const sender = maskSender(from, r1, r2);
          const date = lastMsg.internalDate
            ? new Date(parseInt(lastMsg.internalDate)).toISOString()
            : "";
          const hasUnread = messages.some((m) => (m.labelIds || []).includes("UNREAD"));
          return {
            id: item.id,
            subject,
            snippet: sanitize(item.snippet || ""),
            date,
            sender,
            messageCount: messages.length,
            hasUnread,
          };
        } catch {
          return null;
        }
      })
    );

    return NextResponse.json({
      threads: threads.filter(Boolean),
      nextPageToken,
      configured: true,
    });
  } catch (err: any) {
    console.error("Threads error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
