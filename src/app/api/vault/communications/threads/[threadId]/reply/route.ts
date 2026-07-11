// src/app/api/vault/communications/threads/[threadId]/reply/route.ts
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

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const dbClient = await getAuth(req);
    if (!dbClient) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const text = (body.body || "").trim();
    if (!text) return NextResponse.json({ error: "Body is required" }, { status: 400 });

    const { threadId } = params;

    const { data: settings } = await dbClient
      .from("reviewer_settings")
      .select("sender_email, reviewer_1_email, reviewer_2_email")
      .eq("id", 1)
      .single();

    const senderEmail = settings?.sender_email || "ravi.soni4254@gmail.com";
    const r1 = settings?.reviewer_1_email;
    const r2 = settings?.reviewer_2_email;

    if (!r1) {
      return NextResponse.json({ error: "Reviewer emails not configured." }, { status: 400 });
    }

    const gmail = getGmailClient();

    const threadRes = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "METADATA" as "METADATA",
      metadataHeaders: ["Subject", "Message-ID", "References"],
    });

    const messages = threadRes.data.messages || [];
    const lastMsg = messages[messages.length - 1];
    const headers = (lastMsg?.payload?.headers || []) as { name: string; value: string }[];

    const originalSubject = getHeader(headers, "Subject");
    const originalMsgId = getHeader(headers, "Message-ID");
    const existingRefs = getHeader(headers, "References");

    const replySubject = originalSubject.toLowerCase().startsWith("re:")
      ? originalSubject
      : `Re: ${originalSubject}`;

    const references = existingRefs
      ? `${existingRefs} ${originalMsgId}`.trim()
      : originalMsgId;

    const raw = buildEmail({
      to: r1,
      cc: r2 || undefined,
      from: senderEmail,
      subject: replySubject,
      body: text,
      inReplyTo: originalMsgId || undefined,
      references: references || undefined,
    });

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodeMessage(raw), threadId },
    });

    return NextResponse.json({
      success: true,
      messageId: result.data.id,
      threadId: result.data.threadId,
    });
  } catch (err: any) {
    console.error("Reply error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
