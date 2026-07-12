// src/app/api/vault/communications/threads/[threadId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient, extractBody } from "@/lib/gmail";

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

/**
 * Sanitize any text that reaches the browser.
 * Removes/replaces all references to FatJoe, linkbuilding.company,
 * and specific email addresses that must never be exposed.
 */
function sanitize(text: string): string {
  if (!text) return text;

  // 1. Specific email addresses (case-insensitive)
  const blockedEmails = [
    "betty.soare@fatjoe.com",
    "jayson.sallatic@fatjoe.com",
    "valme.claro@fatjoe.com",
    "ravi@linkbuilding.company",
  ];
  for (const email of blockedEmails) {
    text = text.replace(new RegExp(escapeRegex(email), "gi"), "[redacted]");
  }

  // 2. Any remaining @fatjoe.com email addresses (e.g. other team members)
  text = text.replace(/[\w.+-]+@fatjoe\.com/gi, "[redacted]");

  // 3. "FatJoe" / "Fat Joe" brand mentions
  text = text.replace(/fat\s*joe/gi, "[redacted]");

  // 4. ravi@linkbuilding.company (already caught above, but keep for safety)
  text = text.replace(/ravi@linkbuilding\.company/gi, "[redacted]");

  // 5. linkbuilding.company domain mentions
  text = text.replace(/linkbuilding\.company/gi, "[redacted]");

  // 6. "link building company" text mentions
  text = text.replace(/link\s+building\s+company/gi, "[redacted]");

  // 7. Strip email signature blocks that may contain the above
  text = stripDirtySignature(text);

  return text;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * If a signature block (after -- / Best regards / Kind regards / Thanks,)
 * contains "[redacted]" after sanitization, remove the whole block.
 */
function stripDirtySignature(text: string): string {
  const sigPattern = /(\r?\n|\s{2,})(--|Best regards|Kind regards|Warm regards|Thanks,|Regards,|Cheers,|Sincerely,)[^\n]*/i;
  const match = sigPattern.exec(text);
  if (!match) return text;

  const before = text.slice(0, match.index);
  const after = text.slice(match.index);

  // Only strip if the signature region contains redacted markers
  if (after.includes("[redacted]")) {
    return before.trimEnd();
  }
  return text;
}

export async function GET(req: NextRequest, { params }: { params: { threadId: string } }) {
  try {
    const { threadId } = params;

    const { data: settings } = await db
      .from("reviewer_settings")
      .select("reviewer_1_email, reviewer_2_email")
      .eq("id", 1)
      .single();

    const r1 = settings?.reviewer_1_email || "";
    const r2 = settings?.reviewer_2_email || "";

    const gmail = getGmailClient();
    const res = await gmail.users.threads.get({ userId: "me", id: threadId, format: "FULL" as "FULL" });

    const messages = (res.data.messages || []).map((msg) => {
      const headers = (msg.payload?.headers || []) as { name: string; value: string }[];
      const from = getHeader(headers, "From");
      const messageId = getHeader(headers, "Message-ID");
      const references = getHeader(headers, "References");
      const subject = sanitize(getHeader(headers, "Subject"));
      const date = msg.internalDate ? new Date(parseInt(msg.internalDate)).toISOString() : "";
      const rawBody = extractBody(msg.payload);
      return {
        id: msg.id,
        messageId,
        references,
        subject,
        sender: maskSender(from, r1, r2),
        date,
        body: sanitize(rawBody),
      };
    });

    try {
      await gmail.users.threads.modify({ userId: "me", id: threadId, requestBody: { removeLabelIds: ["UNREAD"] } });
    } catch { /* ignore */ }

    const subject = sanitize(messages[0]?.subject || "(no subject)");
    return NextResponse.json({ threadId, subject, messages });
  } catch (err: any) {
    console.error("Thread detail error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
