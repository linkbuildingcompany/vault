// src/app/vault/settings/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  Mail,
  Users,
  ChevronRight,
  Save,
  Check,
  AlertCircle,
  Loader2,
  Settings,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReviewerSettings {
  reviewer_1_email: string;
  reviewer_2_email: string;
}

// ── Settings sections config ──────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "reviewers",
    label: "Reviewer Emails",
    icon: Users,
    description: "Configure who receives review communications",
  },
  // Add more sections here as needed in the future
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function VaultSettingsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState("reviewers");

  // Reviewer settings state
  const [reviewerSettings, setReviewerSettings] = useState<ReviewerSettings>({
    reviewer_1_email: "",
    reviewer_2_email: "",
  });
  const [originalSettings, setOriginalSettings] = useState<ReviewerSettings>({
    reviewer_1_email: "",
    reviewer_2_email: "",
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && role !== "admin") {
      router.replace("/vault/website-review");
    }
  }, [authLoading, role, router]);

  // Load reviewer settings
  useEffect(() => {
    if (role !== "admin") return;
    setLoadingSettings(true);
    fetch("/api/vault/communications/settings")
      .then((r) => r.json())
      .then((data) => {
        const s = {
          reviewer_1_email: data.reviewer_1_email || "",
          reviewer_2_email: data.reviewer_2_email || "",
        };
        setReviewerSettings(s);
        setOriginalSettings(s);
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, [role]);

  const isDirty =
    reviewerSettings.reviewer_1_email !== originalSettings.reviewer_1_email ||
    reviewerSettings.reviewer_2_email !== originalSettings.reviewer_2_email;

  const saveReviewerSettings = async () => {
    setSaving(true);
    setSaveStatus("idle");
    setSaveMsg("");
    try {
      const res = await fetch("/api/vault/communications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewerSettings),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveStatus("success");
        setSaveMsg("Settings saved successfully.");
        setOriginalSettings({ ...reviewerSettings });
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setSaveMsg(data.error || "Failed to save settings.");
      }
    } catch {
      setSaveStatus("error");
      setSaveMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (role !== "admin") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          </div>
          <p className="text-sm text-gray-500 ml-12">
            Manage your Vault configuration — admin only
          </p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-56 flex-shrink-0">
            <nav className="space-y-1">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                      active
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {s.label}
                    </div>
                    {active && <ChevronRight className="h-3 w-3 opacity-60" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {/* ── Reviewer Emails section ─────────────────────────── */}
            {activeSection === "reviewers" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Section header */}
                <div className="px-6 py-5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">
                        Reviewer Emails
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        These addresses receive review communications. Never visible to viewers.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fields */}
                <div className="px-6 py-6">
                  {loadingSettings ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading settings…
                    </div>
                  ) : (
                    <div className="space-y-5 max-w-md">
                      {/* Reviewer 1 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Reviewer 1
                          <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            TO
                          </span>
                        </label>
                        <input
                          type="email"
                          value={reviewerSettings.reviewer_1_email}
                          onChange={(e) =>
                            setReviewerSettings((s) => ({
                              ...s,
                              reviewer_1_email: e.target.value,
                            }))
                          }
                          placeholder="reviewer1@example.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          Primary reviewer — listed as "Reviewer 1" in the app
                        </p>
                      </div>

                      {/* Reviewer 2 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Reviewer 2
                          <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            CC
                          </span>
                        </label>
                        <input
                          type="email"
                          value={reviewerSettings.reviewer_2_email}
                          onChange={(e) =>
                            setReviewerSettings((s) => ({
                              ...s,
                              reviewer_2_email: e.target.value,
                            }))
                          }
                          placeholder="reviewer2@example.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          Secondary reviewer — CC'd on all communications
                        </p>
                      </div>

                      {/* Status message */}
                      {saveStatus !== "idle" && (
                        <div
                          className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                            saveStatus === "success"
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {saveStatus === "success" ? (
                            <Check className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          )}
                          {saveMsg}
                        </div>
                      )}

                      {/* Save button */}
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={saveReviewerSettings}
                          disabled={saving || !isDirty}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {saving ? "Saving…" : "Save Settings"}
                        </button>
                        {isDirty && !saving && (
                          <span className="text-xs text-amber-600">Unsaved changes</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Info footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    🔒 These email addresses are stored securely and only used server-side. 
                    Team members see "Reviewer 1" and "Reviewer 2" — never the real addresses.
                  </p>
                </div>
              </div>
            )}

            {/* Future sections can be added here */}
          </main>
        </div>
      </div>
    </div>
  );
}
