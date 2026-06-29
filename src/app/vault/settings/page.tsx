"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";

export default function SettingsPage() {
  const { role, loading } = useAuth();
  const router = useRouter();
  const [fromEmail, setFromEmail] = useState("");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && role !== "admin") router.push("/vault/client-approval-queue");
  }, [role, loading, router]);

  useEffect(() => {
    if (!loading && role === "admin") {
      fetch("/api/vault/settings")
        .then((r) => r.json())
        .then((d) => {
          setFromEmail(d.intro_from_email ?? "ravi.soni4254@gmail.com");
          setFetching(false);
        });
    }
  }, [role, loading]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/vault/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intro_from_email: fromEmail }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading || role !== "admin") {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Settings</h2>

      <div className="bg-white rounded-lg border p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-700">Introduction Emails</h3>

        <div className="space-y-2">
          <label className="text-sm text-gray-600">Default From Email</label>
          {fetching ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <Input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="ravi.soni4254@gmail.com"
            />
          )}
          <p className="text-xs text-gray-400">
            Shown as the sender reference when composing introduction emails.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-600">Recipients</label>
          <div className="text-sm bg-gray-50 rounded-md px-4 py-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Client Contact 1</span>
              <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">To</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Client Contact 2</span>
              <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">CC</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Email addresses are stored securely in the application.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={handleSave} disabled={saving || fetching} size="sm" className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </div>
    </main>
  );
}
