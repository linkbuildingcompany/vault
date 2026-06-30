// src/app/api/vault/run-sheet-import/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createServerClient } from "@/lib/supabase";
import { getGmailClient } from "@/lib/gmail";
import { stripDomain } from "@/lib/utils";

const FATJOE_RECIPIENTS = [
  "betty.soare@fatjoe.com",
  "jayson.sallatic@fatjoe.com",
];
const SENDER = process.env.GMAIL_SENDER || "ravi.soni4254@gmail.com";

// Build a plain-text + HTML notification email
function buildNotificationEmail(newDomains: string[]): string {
  const domainList = newDomains.map((d) => `  • ${d}`).join("\n");
  const domainListHtml = newDomains
    .map((d) => `<li style="margin:4px 0;">${d}</li>`)
    .join("");

  const subject = `${newDomains.length} New Domain${newDomains.length > 1 ? "s" : ""} Added to Vault`;

  const textBody = `Hi Team,

${newDomains.length} new domain${newDomains.length > 1 ? "s have" : " has"} been added to the Vault and ${newDomains.length > 1 ? "are" : "is"} ready for link building outreach:

${domainList}

We'll be reaching out to each of these shortly.

Best,
Ravi`;

  const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;max-width:600px;">
  <p>Hi Team,</p>
  <p>${newDomains.length} new domain${newDomains.length > 1 ? "s have" : " has"} been added to the Vault and ${newDomains.length > 1 ? "are" : "is"} ready for link building outreach:</p>
  <ul style="padding-left:20px;">
    ${domainListHtml}
  </ul>
  <p>We'll be reaching out to each of these shortly.</p>
  <p>Best,<br/>Ravi</p>
</div>`;

  const toHeader = FATJOE_RECIPIENTS.join(", ");

  const message = [
    `From: ${SENDER}`,
    `To: ${toHeader}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="boundary_alt"`,
    ``,
    `--boundary_alt`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    textBody,
    ``,
    `--boundary_alt`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    htmlBody,
    ``,
    `--boundary_alt--`,
  ].join("\r\n");

  return Buffer.from(message).toString("base64url");
}

// POST /api/vault/run-sheet-import
export async function POST() {
  try {
    const supabase = createServerClient();

    // ── 1. Auth for Google Sheets ────────────────────────────────────────────
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      return NextResponse.json(
        { error: "GOOGLE_SERVICE_ACCOUNT_JSON env var not set" },
        { status: 500 }
      );
    }

    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // ── 2. Fetch sheet data ──────────────────────────────────────────────────
    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID ||
      "12vTYSL-BrTyMbcK_-LDpv8Smg_KOoCGgwXMI-QZoEx0";
    const sheetName = process.env.GOOGLE_SHEET_NAME || "List of sites";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:L`,
    });

    const rows = response.data.values || [];
    const dataRows = rows.slice(1); // skip header

    // ── 3. Parse sheet rows ──────────────────────────────────────────────────
    type SheetRecord = {
      website_url: string;
      accepted: "Y" | "N" | "pending";
      created_at: string;
    };

    const sheetRecords: SheetRecord[] = [];

    for (const row of dataRows) {
      const rawDomain = (row[0] || "").toString().trim();
      if (!rawDomain) continue;
      const domain = stripDomain(rawDomain);
      if (!domain) continue;

      const acceptedRaw = (row[1] || "").toString().trim().toUpperCase();
      const accepted: "Y" | "N" | "pending" =
        acceptedRaw === "Y" ? "Y" : acceptedRaw === "N" ? "N" : "pending";

      const dateAdded = (row[11] || "").toString().trim();
      let createdAt: string;
      if (dateAdded) {
        const parsed = new Date(dateAdded);
        createdAt = isNaN(parsed.getTime())
          ? new Date().toISOString()
          : parsed.toISOString();
      } else {
        createdAt = new Date().toISOString();
      }

      sheetRecords.push({ website_url: domain, accepted, created_at: createdAt });
    }

    // ── 4. Get existing domains from DB ──────────────────────────────────────
    const { data: existingItems, error: fetchError } = await supabase
      .from("vault_items")
      .select("website_url, accepted");

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingUrls = new Set(
      (existingItems || []).map((i: { website_url: string }) => i.website_url)
    );

    // ── 5. Split into new vs existing ────────────────────────────────────────
    const newRecords = sheetRecords.filter(
      (r) => !existingUrls.has(r.website_url)
    );
    const updateRecords = sheetRecords.filter((r) =>
      existingUrls.has(r.website_url)
    );

    // ── 6. Insert new domains ────────────────────────────────────────────────
    let inserted = 0;
    if (newRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("vault_items")
        .insert(newRecords);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      inserted = newRecords.length;
    }

    // ── 7. Update accepted status for existing domains ───────────────────────
    // (batch update each one — preserves partner_email / gmail_thread_id)
    for (const rec of updateRecords) {
      await supabase
        .from("vault_items")
        .update({ accepted: rec.accepted })
        .eq("website_url", rec.website_url);
    }

    // ── 8. Notify FatJoe about new domains ───────────────────────────────────
    let emailSent = false;
    if (newRecords.length > 0) {
      try {
        const gmail = getGmailClient();
        const raw = buildNotificationEmail(newRecords.map((r) => r.website_url));
        await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw },
        });
        emailSent = true;
      } catch (emailErr) {
        // Non-fatal — log but don't fail the import
        console.error("Failed to send FatJoe notification:", emailErr);
      }
    }

    return NextResponse.json({
      ok: true,
      inserted,
      updated: updateRecords.length,
      notificationSent: emailSent,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
