import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createServerClient } from "@/lib/supabase";
import { stripDomain } from "@/lib/utils";

// POST /api/vault/run-sheet-import
export async function POST() {
  try {
    const supabase = createServerClient();

    // --- Auth via service account ---
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

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID || "12vTYSL-BrTyMbcK_-LDpv8Smg_KOoCGgwXMI-QZoEx0";
    const sheetName = process.env.GOOGLE_SHEET_NAME || "List of sites";

    // Fetch columns A, B, and L
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:L`,
    });

    const rows = response.data.values || [];
    // Skip header row
    const dataRows = rows.slice(1);

    // Build insert records
    type InsertRow = {
      website_url: string;
      accepted: "Y" | "N" | "pending";
      created_at: string;
    };

    const records: InsertRow[] = [];

    for (const row of dataRows) {
      const rawDomain = (row[0] || "").toString().trim();
      if (!rawDomain) continue;

      const domain = stripDomain(rawDomain);
      if (!domain) continue;

      const acceptedRaw = (row[1] || "").toString().trim().toUpperCase();
      const accepted: "Y" | "N" | "pending" =
        acceptedRaw === "Y" ? "Y" : acceptedRaw === "N" ? "N" : "pending";

      // Column L is index 11
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

      records.push({ website_url: domain, accepted, created_at: createdAt });
    }

    // Wipe and re-insert
    const { error: deleteError } = await supabase
      .from("vault_items")
      .delete()
      .neq("id", 0); // delete all rows

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from("vault_items")
        .insert(records);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, inserted: records.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
