// src/app/api/vault/alina/threads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

function getAlinaGmailClient(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.ALINA_CLIENT_ID,
    process.env.ALINA_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function maskSender(from: string, alinaEmail: string, tab: string): string {
  const lower = from.toLowerCase();
  if (alinaEmail && lower.includes(alinaEmail.toLowerCase())) return "You";
  if (lower.includes("@fatjoe.com")) return "FatJoe Team";
  return tab === "orders" ? "FatJoe Team" : "Partner";
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
  text = text.replace(/<img\b[^>]*\/?>/gi, "");
  text = text.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, "");
  text = text.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, "");
  text = text.replace(/src=["']cid:[^"']*["']/gi, 'src=""');
  text = text.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+/gi, "");
  text = text.replace(/\[cid:[^\]]*\]/gi, "");
  text = stripSignature(text);

  const blockedEmails = [
    "betty.soare@fatjoe.com", "jayson.sallatic@fatjoe.com",
    "valme.claro@fatjoe.com", "outreach@fatjoe.com",
    "ravi@linkbuilding.company",
  ];
  for (const email of blockedEmails) {
    text = text.replace(new RegExp(escapeRegex(email), "gi"), "[redacted]");
  }
  text = text.replace(/[\w.+-]+@fatjoe\.com/gi, "[redacted]");

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

  text = text.replace(/fat\s*joe/gi, "[redacted]");
  text = text.replace(/\bfatjoe\.com\b/gi, "[redacted]");
  text = text.replace(/[\w.+-]+@linkbuilding\.company/gi, "[redacted]");
  text = text.replace(/\blinkbuilding\.company\b/gi, "[redacted]");
  text = text.replace(/link\s+building\s+company/gi, "[redacted]");

  text = text.replace(/(\+?[\d\s\-().]{7,20}(?:\s*(ext|x)\.?\s*\d{1,6})?)/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) return "[redacted]";
    return match;
  });

  text = text.replace(/^\s*(website|web|www)\s*:.*$/gim, "[redacted]");
  text = text.replace(/(\[redacted\]\s*\n){2,}/g, "[redacted]\n");
  text = text.replace(/(\[redacted\]\s*){2,}/g, "[redacted] ");

  return text.trim();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "partners";
    const search = searchParams.get("search") || "";
    const pageToken = searchParams.get("pageToken") || undefined;

    const { data: settings } = await db
      .from("reviewer_settings")
      .select("*")
      .eq("id", 1)
      .single();

    const alinaEmail = settings?.alina_email || "alina@rehiring.net";
    const alinaToken = settings?.alina_refresh_token || "";

    if (!alinaToken) {
      return NextResponse.json({ threads: [], nextPageToken: null, configured: false });
    }

    const gmail = getAlinaGmailClient(alinaToken);

    let q = tab === "orders" ? "from:fatjoe.com" : "-from:fatjoe.com";
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
          const sender = maskSender(from, alinaEmail, tab);
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
    console.error("Alina threads error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
