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

function maskSender(
  from: string,
  r1: string,
  r2: string,
  senderEmail: string,
  outreach1: string
): string {
  const lower = from.toLowerCase();
  if (senderEmail && lower.includes(senderEmail.toLowerCase())) return "You";
  if (r1 && lower.includes(r1.toLowerCase())) return "Reviewer 1";
  if (r2 && lower.includes(r2.toLowerCase())) return "Reviewer 2";
  if (outreach1 && lower.includes(outreach1.toLowerCase())) return "Outreach Email 1";
  return "Partner";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SIGNOFF_PHRASES = [
  "kind regards", "best regards", "warm regards", "many thanks",
  "thanks,", "thanks!", "thank you,", "thank you!", "regards,",
  "cheers,", "sincerely,", "with regards,", "yours sincerely,",
  "yours faithfully,", "best,", "all the best,", "--",
];

function stripSignature(text: string): string {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim().toLowerCase();
    if (SIGNOFF_PHRASES.some((s) => trimmed === s || trimmed.startsWith(s + " "))) {
      return lines.slice(0, i).join("\n").trimEnd();
    }
  }
  return text;
}

function sanitize(text: string): string {
  if (!text) return text;

  // 0. Strip all images
  text = text.replace(/<img\b[^>]*\/?>/gi, "");
  text = text.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, "");
  text = text.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, "");
  text = text.replace(/src=["']cid:[^"']*["']/gi, 'src=""');
  text = text.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+/gi, "");
  text = text.replace(/\[cid:[^\]]*\]/gi, "");

  // 1. Strip signature block
  text = stripSignature(text);

  // 2. Blocked email addresses
  const blockedEmails = [
    "betty.soare@fatjoe.com",
    "jayson.sallatic@fatjoe.com",
    "valme.claro@fatjoe.com",
    "outreach@fatjoe.com",
    "ravi@linkbuilding.company",
  ];
  for (const email of blockedEmails) {
    text = text.replace(new RegExp(escapeRegex(email), "gi"), "[redacted]");
  }

  // 3. Any @fatjoe.com address
  text = text.replace(/[\w.+-]+@fatjoe\.com/gi, "[redacted]");

  // 4. FatJoe brand + domain
  text = text.replace(/fat\s*joe/gi, "[redacted]");
  text = text.replace(/\bfatjoe\.com\b/gi, "[redacted]");

  // 5. linkbuilding.company
  text = text.replace(/[\w.+-]+@linkbuilding\.company/gi, "[redacted]");
  text = text.replace(/\blinkbuilding\.company\b/gi, "[redacted]");
  text = text.replace(/link\s+building\s+company/gi, "[redacted]");

  // 6. Phone numbers
  text = text.replace(/(\+?[\d\s\-().]{7,20}(?:\s*(ext|x)\.?\s*\d{1,6})?)/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) return "[redacted]";
    return match;
  });

  // 7. Website lines
  text = text.replace(/^\s*(website|web|www)\s*:.*$/gim, "[redacted]");

  // 8. Lines with fatjoe.com
  text = text.replace(/^.*\bfatjoe\.com\b.*$/gim, "[redacted]");

  // 9. Physical address lines
  text = text.replace(/^.*(p\.?o\.?\s*box|\bsuite\b|\bfloor\b|\bunit\b|\broad\b|\bstreet\b|\bave\b|\bavenue\b|\blane\b|\bplace\b|\bdrive\b|[A-Z]{1,2}\d[\d\w]?\s*\d[A-Z]{2}|\b\d{5}(-\d{4})?\b).*$/gim, "[redacted]");

  // 10. Company registration lines
  text = text.replace(/^.*(company\s*(no|number|reg|registration)|reg(istered)?\s*(no|number)).*$/gim, "[redacted]");

  // 11. Legal disclaimer
  text = text.replace(/^.*(private and confidential|personal data|personal views|received this message in error|do not use, copy|disclose the information).*$/gim, "[redacted]");

  // 12. Social media URLs
  text = text.replace(
    /https?:\/\/(www\.)?(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|t\.co|fb\.com|fb\.me|lnkd\.in|bit\.ly|ow\.ly|buff\.ly)\/\S*/gi,
    "[redacted]"
  );
  text = text.replace(
    /(^|\s)(www\.)?(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|lnkd\.in)\/\S*/gim,
    " [redacted]"
  );

  // 13. Social @handles
  text = text.replace(/(^|\s)@[A-Za-z0-9_]{2,}/gm, (m, prefix) => prefix + "[redacted]");

  // 14. Job title / role lines
  const titleKeywords = [
    "manager", "director", "specialist", "executive", "coordinator",
    "analyst", "consultant", "strategist", "associate", "representative",
    "head of", "vp ", "vice president", "ceo", "coo", "cto", "cfo",
    "founder", "co-founder", "partner", "lead", "officer", "editor",
    "writer", "producer", "outreach", "seo", "sem", "content", "marketing",
    "account manager", "project manager", "team lead", "link builder",
    "link building", "pr specialist", "digital marketing", "operations",
  ];
  const titlePattern = new RegExp(
    `^[^\\n]{0,80}(${titleKeywords.map(escapeRegex).join("|")})[^\\n]{0,80}$`,
    "gim"
  );
  text = text.replace(titlePattern, "[redacted]");

  // 15. Collapse multiple [redacted]
  text = text.replace(/(\[redacted\]\s*\n){2,}/g, "[redacted]\n");
  text = text.replace(/(\[redacted\]\s*){2,}/g, "[redacted] ");

  return text.trim();
}

export async function GET(req: NextRequest, { params }: { params: { threadId: string } }) {
  try {
    const { threadId } = params;

    const { data: settings } = await db
      .from("reviewer_settings")
      .select("*")
      .eq("id", 1)
      .single();

    const r1 = settings?.reviewer_1_email || "";
    const r2 = settings?.reviewer_2_email || "";
    const senderEmail = settings?.sender_email || "ravi.soni4254@gmail.com";
    const outreach1 = settings?.outreach_email_1 || "";

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
        sender: maskSender(from, r1, r2, senderEmail, outreach1),
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
