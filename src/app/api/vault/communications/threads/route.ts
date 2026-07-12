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

// Sign-off phrases — everything from this line onward is stripped
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

  // 0. Strip all images before anything else
  text = text.replace(/<img\b[^>]*\/?>/gi, "");                                          // <img> tags
  text = text.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, "");                      // <picture> elements
  text = text.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, "");                        // <figure> elements
  text = text.replace(/src=["']cid:[^"']*["']/gi, 'src=""');                             // CID inline embeds
  text = text.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+/gi, "");              // base64 data URIs
  text = text.replace(/\[cid:[^\]]*\]/gi, "");                                            // [cid:...] plain-text refs

  // 1. Strip signature block first (everything from sign-off line down)
  text = stripSignature(text);

  // 2. Blocked email addresses
  const blockedEmails = [
    "betty.soare@fatjoe.com",
    "jayson.sallatic@fatjoe.com",
    "valme.claro@fatjoe.com",
    "ravi@linkbuilding.company",
  ];
  for (const email of blockedEmails) {
    text = text.replace(new RegExp(escapeRegex(email), "gi"), "[redacted]");
  }

  // 3. Any @fatjoe.com address
  text = text.replace(/[\w.+-]+@fatjoe\.com/gi, "[redacted]");

  // 4. FatJoe brand mentions + domain
  text = text.replace(/fat\s*joe/gi, "[redacted]");
  text = text.replace(/\bfatjoe\.com\b/gi, "[redacted]");

  // 5. linkbuilding.company domain + phrase
  text = text.replace(/[\w.+-]+@linkbuilding\.company/gi, "[redacted]");
  text = text.replace(/\blinkbuilding\.company\b/gi, "[redacted]");
  text = text.replace(/link\s+building\s+company/gi, "[redacted]");

  // 6. Phone numbers (UK, US, international formats)
  text = text.replace(/(\+?[\d\s\-().]{7,20}(?:\s*(ext|x)\.?\s*\d{1,6})?)/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) return "[redacted]";
    return match;
  });

  // 7. "Website:" / "Web:" lines
  text = text.replace(/^\s*(website|web|www)\s*:.*$/gim, "[redacted]");

  // 8. Lines with known domains (fatjoe.com etc.)
  text = text.replace(/^.*\bfatjoe\.com\b.*$/gim, "[redacted]");

  // 9. Physical address lines — lines with postcode/zip or street keywords
  text = text.replace(/^.*(p\.?o\.?\s*box|\bsuite\b|\bfloor\b|\bunit\b|\broad\b|\bstreet\b|\bave\b|\bavenue\b|\blane\b|\bplace\b|\bdrive\b|[A-Z]{1,2}\d[\d\w]?\s*\d[A-Z]{2}|\b\d{5}(-\d{4})?\b).*$/gim, "[redacted]");

  // 10. Company registration lines
  text = text.replace(/^.*(company\s*(no|number|reg|registration)|reg(istered)?\s*(no|number)).*$/gim, "[redacted]");

  // 11. Legal disclaimer paragraphs (long lines with "private", "confidential", "personal data")
  text = text.replace(/^.*(private and confidential|personal data|personal views|received this message in error|do not use, copy|disclose the information).*$/gim, "[redacted]");

  // 12. Social media profile URLs
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

  // 15. Collapse multiple [redacted] lines
  text = text.replace(/(\[redacted\]\s*\n){2,}/g, "[redacted]\n");
  text = text.replace(/(\[redacted\]\s*){2,}/g, "[redacted] ");

  return text.trim();
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
