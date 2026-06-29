"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Mail, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VaultItem } from "@/lib/supabase";

const TO_EMAIL = "betty.soare@fatjoe.com";
const CC_EMAIL = "jayson.sallatic@fatjoe.com";

export default function IntroductionsPage() {
  const { role, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fromEmail, setFromEmail] = useState("ravi.soni4254@gmail.com");
  const [marking, setMarking] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && role !== "admin") router.push("/vault/client-approval-queue");
  }, [role, loading, router]);

  useEffect(() => {
    if (!loading && role === "admin") fetchData();
  }, [role, loading]);

  async function fetchData() {
    setFetching(true);
    try {
      const [itemsRes, settingsRes] = await Promise.all([
        fetch("/api/vault/introductions"),
        fetch("/api/vault/settings"),
      ]);
      const itemsData = await itemsRes.json();
      const settingsData = await settingsRes.json();
      setItems(Array.isArray(itemsData) ? itemsData : []);
      if (settingsData.intro_from_email) setFromEmail(settingsData.intro_from_email);
    } finally {
      setFetching(false);
    }
  }

  function getGmailUrl(domain: string) {
    const subject = encodeURIComponent(`Introduction: ${domain}`);
    const body = encodeURIComponent(`Hi,\n\nI'd like to introduce you to ${domain}.\n\nBest regards,\nRavi`);
    return `https://mail.google.com/mail/?view=cm&to=${TO_EMAIL}&cc=${CC_EMAIL}&su=${subject}&body=${body}`;
  }

  async function handleMarkIntroduced(id: number) {
    setMarking(id);
    try {
      await fetch(`/api/vault/introductions/${id}/mark`, { method: "POST" });
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, introduced_at: new Date().toISOString() } : i))
      );
    } finally {
      setMarking(null);
    }
  }

  if (loading || role !== "admin") {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const pending = items.filter((i) => !i.introduced_at);
  const introduced = items.filter((i) => i.introduced_at);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Partner Introductions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {pending.length} pending · {introduced.length} introduced
          </p>
        </div>
        <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
          From: {fromEmail}
        </div>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-white px-6 py-16 text-center text-gray-400">
          No approved domains yet. Mark domains as &quot;Y&quot; in the Approval Queue first.
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Domain</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">Approved On</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-28">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-52">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-800">{item.website_url}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(item.created_at).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.introduced_at ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle className="h-3.5 w-3.5" /> Done
                      </span>
                    ) : (
                      <span className="text-xs text-yellow-600 font-medium">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.introduced_at ? (
                      <span className="text-xs text-gray-400">
                        {new Date(item.introduced_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-7 text-xs"
                          onClick={() => window.open(getGmailUrl(item.website_url), "_blank")}
                        >
                          <Mail className="h-3 w-3" />
                          Compose
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={() => handleMarkIntroduced(item.id)}
                          disabled={marking === item.id}
                        >
                          {marking === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3" />
                          )}
                          Mark Done
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 0 && (
            <div className="border-t px-4 py-2 text-xs text-gray-400">
              Showing {items.length} approved domains · Recipients hidden for privacy
            </div>
          )}
        </div>
      )}
    </main>
  );
}
