import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client (same for now — no auth needed)
export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export type VaultItem = {
  id: number;
  website_url: string;
  accepted: "pending" | "Y" | "N";
  created_at: string;
};
