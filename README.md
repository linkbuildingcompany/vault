# Vault — Client Approval Queue

A Next.js app for managing client domain approvals, synced from Google Sheets.

## Stack
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Next.js API Routes (serverless)
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/migrations/001_vault_items.sql`
3. Copy your **Project URL** and **anon public key** from Settings → API

### 2. Google Sheets Service Account

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **Google Sheets API**
3. Create a **Service Account** → generate a JSON key
4. Share the spreadsheet with the service account email (Viewer access)
5. Copy the entire JSON key (you'll paste it as one line in Vercel)

### 3. Vercel

1. Push this repo to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add these environment variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full service account JSON (one line) |
| `GOOGLE_SHEET_ID` | `12vTYSL-BrTyMbcK_-LDpv8Smg_KOoCGgwXMI-QZoEx0` |
| `GOOGLE_SHEET_NAME` | `List of sites` |

4. Deploy!

---

## API Reference

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/vault/items?month=YYYY-MM` | List items (filtered by month) |
| POST | `/api/vault/items` | Add a single domain |
| PATCH | `/api/vault/items/:id/status` | Update accepted status |
| DELETE | `/api/vault/items/:id` | Delete a domain |
| POST | `/api/vault/run-sheet-import` | Wipe + re-import from Google Sheets |

## Local Development

```bash
cp .env.example .env.local
# Fill in your values in .env.local

npm install
npm run dev
```

Open [http://localhost:3000/vault/client-approval-queue](http://localhost:3000/vault/client-approval-queue)
