// src/app/api/vault/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { stripDomain } from "@/lib/utils";
import { getGmailClient, buildEmailWithAttachments, encodeMessage } from "@/lib/gmail";

const FATJOE_TO = "betty.soare@fatjoe.com";
const FATJOE_CC = "jayson.sallatic@fatjoe.com";

// GET /api/vault/items?month=YYYY-MM
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const month = req.nextUrl.searchParams.get("month");

  let query = supabase
    .from("vault_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (month) {
    const start = `${month}-01`;
    const [year, mon] = month.split("-").map(Number);
    const nextMonth =
      mon === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
    query = query.gte("created_at", start).lt("created_at", nextMonth);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// POST /api/vault/items — add a single domain + notify FatJoe
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json();
  const domain = stripDomain(body.website_url || "");

  if (!domain) {
    return NextResponse.json({ error: "website_url is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vault_items")
    .insert({
      website_url: domain,
      accepted: "pending",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify FatJoe team (non-blocking — failure never blocks the insert)
  try {
    const gmail = getGmailClient();
    const subject = `New Domain Added for Review: ${domain}`;
    const emailBody = [
      `Hi Team,`,
      ``,
      `A new domain has been added to Vault and is awaiting your approval:`,
      ``,
      `  🌐  ${domain}`,
      ``,
      `Please review and let us know if you'd like to proceed with this site.`,
      ``,
      `Thanks,`,
      `Vault`,
    ].join("\n");

    const raw = buildEmailWithAttachments({
      to: FATJOE_TO,
      cc: FATJOE_CC,
      from: process.env.GMAIL_SENDER!,
      subject,
      body: emailBody,
      attachments: [],
    });

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodeMessage(raw) },
    });
  } catch (e) {
    console.error("[vault] FatJoe notify failed:", e);
  }

  return NextResponse.json(data, { status: 201 });
}
