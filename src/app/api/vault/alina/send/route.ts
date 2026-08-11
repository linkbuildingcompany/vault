import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { buildEmail, encodeMessage } from "@/lib/gmail";

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

function validAddressList(value: string): boolean {
  if (!value.trim()) return true;
  return value.split(",").every((part) => {
    const address = part.trim().match(/<([^>]+)>/)?.[1] || part.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
  });
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json().catch(() => ({}));
    const to = String(input.to || "").trim();
    const cc = String(input.cc || "").trim();
    const subject = String(input.subject || "").trim();
    const body = String(input.body || "").trim();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: "To, subject, and message are required" }, { status: 400 });
    }
    if (!validAddressList(to) || !validAddressList(cc)) {
      return NextResponse.json({ error: "Please enter valid email addresses separated by commas" }, { status: 400 });
    }

    const { data: settings } = await db
      .from("reviewer_settings")
      .select("alina_email, alina_refresh_token")
      .eq("id", 1)
      .single();

    const alinaEmail = settings?.alina_email || process.env.ALINA_EMAIL || "alina@aiimpactonservicejobs.com";
    const alinaToken = settings?.alina_refresh_token || process.env.ALINA_REFRESH_TOKEN || "";
    if (!alinaToken) {
      return NextResponse.json({ error: "Alina account not configured" }, { status: 503 });
    }

    const gmail = getAlinaGmailClient(alinaToken);
    const raw = buildEmail({ from: alinaEmail, to, cc: cc || undefined, subject, body });
    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodeMessage(raw) },
    });

    return NextResponse.json({ success: true, messageId: sent.data.id });
  } catch (err: any) {
    console.error("Alina compose error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
