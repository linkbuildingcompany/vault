// src/lib/gmail.ts
import { google } from "googleapis";

export function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "http://localhost"
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

/** Base64url-encode a Buffer or string */
export function encodeMessage(raw: string): string {
  return Buffer.from(raw).toString("base64url");
}

/** Extract plain-text body from a Gmail message payload (handles multipart) */
export function extractBody(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: unknown[] | null;
} | null | undefined): string {
  if (!payload) return "";

  // Direct body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Multipart – prefer text/plain
  if (payload.parts && Array.isArray(payload.parts)) {
    type Part = { mimeType?: string | null; body?: { data?: string | null } | null; parts?: unknown[] | null };
    const parts = payload.parts as Part[];
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
    }
    for (const part of parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        // strip basic HTML tags
        return Buffer.from(part.body.data, "base64url")
          .toString("utf-8")
          .replace(/<[^>]*>/g, "");
      }
      if (part.parts) {
        const nested = extractBody(part as Parameters<typeof extractBody>[0]);
        if (nested) return nested;
      }
    }
  }

  return "";
}

/** Build a simple plain-text RFC 2822 email */
export function buildEmail(opts: {
  to: string;
  cc?: string;
  from: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`] : []),
    ...(opts.references ? [`References: ${opts.references}`] : []),
    ``,
    opts.body,
  ];
  return lines.join("\r\n");
}

/** Build a multipart/mixed email with optional file attachments */
export function buildEmailWithAttachments(opts: {
  to: string;
  cc?: string;
  from: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    data: string; // standard base64
  }>;
}): string {
  if (!opts.attachments || opts.attachments.length === 0) {
    return buildEmail(opts);
  }

  const boundary = `Boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const header = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`] : []),
    ...(opts.references ? [`References: ${opts.references}`] : []),
    ``,
  ].join("\r\n");

  const textPart = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    opts.body,
  ].join("\r\n");

  const attachParts = opts.attachments
    .map((att) => {
      // wrap base64 at 76 chars per MIME spec
      const wrapped = att.data.match(/.{1,76}/g)?.join("\r\n") ?? att.data;
      return [
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        ``,
        wrapped,
      ].join("\r\n");
    })
    .join("\r\n");

  return [header, textPart, attachParts, `--${boundary}--`].join("\r\n");
}
