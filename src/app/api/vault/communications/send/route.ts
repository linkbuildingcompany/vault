// src/app/api/vault/communications/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient, buildEmail, encodeMessage } from "@/lib/gmail";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function getAuth(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const dbClient = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
    : userClient;
  const { data: profile } = await dbClient.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return dbClient;
}

export async function POST(req: NextRequest) {
  try {
    const dbClient = await getAuth(req);
    if (!dbClient) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const subject = (body.subject || "").trim();
    const text = (body.body || "").trim();

    if (!subject || !text) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
    }

    const { data: settings } = await dbClient
      .from("reviewer_settings")
      .select("sender_email, reviewer_1_email, reviewer_2_email")
      .eq("id", 1)
      .single();

    const senderEmail = settings?.sender_email || "ravi.soni4254@gmail.com";
    const r1 = settings?.reviewer_1_email;
    const r2 = settings?.reviewer_2_email;

    if (!r1) {
      return NextResponse.json(
        { error: "Reviewer 1 email not configured. Please set it in Settings." },
        { status: 400 }
      );
    }

    const gmail = getGmailClient();
    const raw = buildEmail({
      to: r1,
      cc: r2 || undefined,
      from: senderEmail,
      subject,
      body: text,
    });

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodeMessage(raw) },
    });

    return NextResponse.json({
      success: true,
      messageId: result.data.id,
      threadId: result.data.threadId,
    });
  } catch (err: any) {
    console.error("Send error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
