import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export type VaultItem = {
  id: number;
  website_url: string;
  accepted: "pending" | "Y" | "N";
  created_at: string;
  introduced_at: string | null;
  gmail_thread_id: string | null;
};

export type Profile = {
  id: string;
  role: "admin" | "viewer";
};
