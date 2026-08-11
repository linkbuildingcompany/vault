// src/app/api/vault/communications/threads/[threadId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient, extractBody, extractHtmlBody } from "@/lib/gmail";

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
  return s.replace(/[.*+?^${}()|[\]\]/g, "\$&");
}

const SIGNOFF_PHRASES = [
  "kind regards", "best regards", "warm regards", "many thanks",
  "thanks,", "thanks!", "thank you,", "thank you!", "regards,",
  "cheers,", "sincerely,", "with regards,", "yours sincerely,",
  "yours faithfully,", "best,", "all the best,", "--",
];

function stripSignature(text: string): string {
  const lines = text.split(/
?
/);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim().toLowerCase();
    if (SIGNOFF_PHRASES.some((s) => trimmed === s || trimmed.startsWith(s + " "))) {
      return lines.slice(0, i).join("
").trimEnd();
    }
  }
  return text;
}

function sanitize(text: string): string {
  if (!text) return text;

  // 0. Strip all images
  text = text.replace(/<img[^>]*\/?>/gi, "");
  text = text.replace(/<picture[^>]*>[\s\S]*?<\/picture>/gi, "");
  text = text.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "");
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

  // 3.5. Blocked person names (FatJoe team)
  const blockedNames = [
    "Jayson Sallatic", "Francis Negel Prado", "Francis Prado",
    "Antonia Higgs", "Isabella Horton", "Kirsty Jennings",
    "R K Sayat", "RK Sayat", "Betty Soare", "Leah Daly",
    "Reuben Glenn Sayat", "Reuben Sayat", "Michaela Tindale",
    "Daniel Trick", "Cherry Ann S", "Emily Bradley",
    "Alasdair Kennedy", "Valme Claro", "Joe T.", "Helen Gaskell",
    "Joe Davies", "Mateus Parize", "Natalie Griffiths",
    "Victoria Ivanova", "Sofia Vallasciani",
    "Pedro Feria Pino", "Pedro Pino", "Niño Brillo", "Nino Brillo",
    "Juan Guillermo Mariño", "Juan Mariño", "Juan Marino",
    "Gemirus Garcia", "Luke Luby", "Emilee Ratcliffe",
    "Connie Paige Wall", "Connie Wall", "Elise Vijfvinkel",
    "Marvi Grace Cuarte", "Marvi Cuarte", "Carla Coetzer",
    "Ariane Canoy", "Kennice Morrison",
    "Mark Joevic Arellano", "Mark Arellano", "Kieran MacGough",
    "Freecy Tutor", "Ryan Grice", "Sarah Salathiel",
    "Sandra Chica", "Daniel Hobson", "Matthew Goodwin",
    "Mary Grace Limbre", "Mary Limbre", "Danielle Samson",
    "Sara McBain", "Parmindar Singh", "Siobhan Jackson",
    "Celine Domenech", "Melinda Visagie", "Robert Shillcock",
    "Abby Marsh", "Amna Sattar",
  ];
  for (const name of blockedNames) {
    text = text.replace(new RegExp(escapeRegex(name), "gi"), "[redacted]");
  }

  // 4. FatJoe brand + domain
  text = text.replace(/fat\s*joe/gi, "[redacted]");
  text = text.replace(/fatjoe\.com/gi, "[redacted]");

  // 5. linkbuilding.company
  text = text.replace(/[\w.+-]+@linkbuilding\.company/gi, "[redacted]");
  text = text.replace(/linkbuilding\.company/gi, "[redacted]");
  text = text.replace(/link\s+building\s+company/gi, "[redacted]");

  // 6. Phone numbers
  text = text.replace(/(\+?[\d 	\-().]{7,20}(?:[ 	]*(ext|x)\.?[ 	]*\d{1,6})?)/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) return "[redacted]";
    return match;
  });

  // 7. Website lines
  text = text.replace(/^\s*(website|web|www)\s*:.*$/gim, "[redacted]");

  // 8. Lines with fatjoe.com
  text = text.replace(/^.*fatjoe\.com.*$/gim, "[redacted]");

  // 9. Physical address lines
  text = text.replace(/^.*(p\.?o\.?\s*box|suite|floor|unit|road|street|ave|avenue|lane|place|drive|[A-Z]{1,2}\d[\d\w]?\s*\d[A-Z]{2}|\d{5}(-\d{4})?).*$/gim, "[redacted]");

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
    `\b(${titleKeywords.map(escapeRegex).join("|")})\b`,
    "i"
  );
  text = text
    .split(/(\r?\n)/)
    .map((line) => {
      if (/^\r?\n$/.test(line)) return line;
      const visible = line
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&[a-z]+;|&#\d+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const wordCount = visible ? visible.split(/\s+/).length : 0;
      const looksLikeRoleLine =
        visible.length <= 80 &&
        wordCount <= 8 &&
        titlePattern.test(visible) &&
        !/[.!?](?:\s|$)/.test(visible);
      return looksLikeRoleLine ? "[redacted]" : line;
    })
    .join("");

  // 15. Collapse multiple [redacted]
  text = text.replace(/(\[redacted\]\s*
){2,}/g, "[redacted]
");
  text = text.replace(/(\[redacted\]\s*){2,}/g, "[redacted] ");

  return text.trim();
}

/** Keep Gmail's HTML formatting while preserving the existing FATJOE redaction rules. */
function sanitizeEmailHtml(html: string): string {
  if (!html) return "";

  // Apply the existing Communications sanitization and masking rules unchanged.
  let safe = sanitize(html);

  // Email HTML is displayed in a sandboxed iframe; remove active/embedded content too.
  safe = safe.replace(/<(script|iframe|object|embed|form|input|button|textarea|select|meta|link|base)[^>]*>[\s\S]*?<\/>/gi, "");
  safe = safe.replace(/<(script|iframe|object|embed|form|input|button|textarea|select|meta|link|base)[^>]*\/?>/gi, "");
  safe = safe.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  safe = safe.replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?/gi, "");
  safe = safe.replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*')/gi, "");

  return safe;
}

function htmlToVisibleText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/>/gi, " ")
    .replace(/<br\s*\/?>/gi, "
")
    .replace(/<\/p\s*>|<\/div\s*>|<\/li\s*>/gi, "
")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Some multipart replies contain an attached HTML copy of an older message but
 * only a plain-text body for the current reply. Use HTML only when it actually
 * starts with the current message; otherwise the plain body is more faithful.
 */
function htmlMatchesCurrentMessage(html: string, plain: string, snippet: string): boolean {
  const htmlText = htmlToVisibleText(html).toLowerCase();
  const snippetText = htmlToVisibleText(snippet || "").toLowerCase();
  const plainText = plain.replace(/\s+/g, " ").trim().toLowerCase();
  const currentText = snippetText || plainText;
  if (!htmlText || !currentText) return false;
  const probe = currentText.slice(0, Math.min(60, currentText.length));
  return probe.length >= 12 && htmlText.slice(0, 500).includes(probe);
}

async function extractCompleteHtmlBody(
  payload: any,
  messageId: string,
  gmail: ReturnType<typeof getGmailClient>
): Promise<string> {
  const inlineHtml = extractHtmlBody(payload);
  if (inlineHtml) return inlineHtml;

  function findHtmlAttachment(part: any): string {
    if (!part) return "";
    if (part.mimeType === "text/html" && part.body?.attachmentId) return part.body.attachmentId;
    for (const child of part.parts || []) {
      const attachmentId = findHtmlAttachment(child);
      if (attachmentId) return attachmentId;
    }
    return "";
  }

  const attachmentId = findHtmlAttachment(payload);
  if (!attachmentId) return "";

  const attachment = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  return attachment.data.data
    ? Buffer.from(attachment.data.data, "base64url").toString("utf-8")
    : "";
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

    const messages = await Promise.all((res.data.messages || []).map(async (msg) => {
      const headers = (msg.payload?.headers || []) as { name: string; value: string }[];
      const from = getHeader(headers, "From");
      const messageId = getHeader(headers, "Message-ID");
      const references = getHeader(headers, "References");
      const subject = sanitize(getHeader(headers, "Subject"));
      const date = msg.internalDate ? new Date(parseInt(msg.internalDate)).toISOString() : "";
      const rawBody = extractBody(msg.payload);
      const rawHtml = await extractCompleteHtmlBody(msg.payload, msg.id!, gmail);
      return {
        id: msg.id,
        messageId,
        references,
        subject,
        sender: maskSender(from, r1, r2, senderEmail, outreach1),
        date,
        body: sanitize(rawBody),
        bodyHtml: rawHtml && htmlMatchesCurrentMessage(rawHtml, rawBody, msg.snippet || "")
          ? sanitizeEmailHtml(rawHtml)
          : "",
      };
    }));

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
