// src/app/vault/settings/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  Mail,
  Users,
  Globe,
  ChevronRight,
  Save,
  Check,
  AlertCircle,
  Loader2,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReviewerSettings {
  sender_email: string;
  reviewer_1_email: string;
  reviewer_2_email: string;
  outreach_email_1: string;
  alina_email: string;
  alina_refresh_token: string;
}

const DEFAULT_SETTINGS: ReviewerSettings = {
  sender_email: "",
  reviewer_1_email: "",
  reviewer_2_email: "",
  outreach_email_1: "",
  alina_email: "",
  alina_refresh_token: "",
};

// ── Settings sections config ──────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "reviewers",
    label: "Reviewer Emails",
    icon: Users,
    description: "Configure who receives review communications",
  },
  {
    id: "outreach",
    label: "Outreach Emails",
    icon: Globe,
    description: "Configure CC address for outreach emails",
  },
  {
    id: "alina",
    label: "Alina Account",
    icon: Mail,
    description: "Configure alina@rehiring.net inbox credentials",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function VaultSettingsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState("reviewers");

  const [reviewerSettings, setReviewerSettings] = useState<ReviewerSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<ReviewerSettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [showToken, setShowToken] = useState(false);

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token || "";
      fetch("/api/vault/communications/settings", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          const s: ReviewerSettings = {
            sender_email: data.sender_email || "",
            reviewer_1_email: data.reviewer_1_email || "",
            reviewer_2_email: data.reviewer_2_email || "",
            outreach_email_1: data.outreach_email_1 || "",
            alina_email: data.alina_email || "",
            alina_refresh_token: data.alina_refresh_token || "",
          };
          setReviewerSettings(s);
          setOriginalSettings(s);
        })
        .catch(() => {})
        .finally(() => setLoadingSettings(false));
    });
  }, [role]);

  const isDirty =
    reviewerSettings.sender_email !== originalSettings.sender_email ||
    reviewerSettings.reviewer_1_email !== originalSettings.reviewer_1_email ||
    reviewerSettings.reviewer_2_email !== originalSettings.reviewer_2_email ||
    reviewerSettings.outreach_email_1 !== originalSettings.outreach_email_1 ||
    reviewerSettings.alina_email !== originalSettings.alina_email ||
    reviewerSettings.alina_refresh_token !== originalSettings.alina_refresh_token;

  const saveReviewerSettings = async () => {
    setSaving(true);
    setSaveStatus("idle");
    setSaveMsg("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const res = await fetch("/api/vault/communications/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

  // ── Shared save UI ─────────────────────────────────────────────────────────
  const SaveUI = () => (
    <div className="space-y-4">
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
  );

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

            {/* ── Reviewer Emails ─────────────────────────────────── */}
            {activeSection === "reviewers" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Reviewer Emails</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Configure sender and recipients for review communications.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-6">
                  {loadingSettings ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading settings…
                    </div>
                  ) : (
                    <div className="space-y-6 max-w-md">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                          Sender
                        </p>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Sender Email
                            <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              FROM
                            </span>
                          </label>
                          <input
                            type="email"
                            value={reviewerSettings.sender_email}
                            onChange={(e) =>
                              setReviewerSettings((s) => ({ ...s, sender_email: e.target.value }))
                            }
                            placeholder="ravi.soni4254@gmail.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                          />
                          <p className="mt-1 text-xs text-gray-400">
                            Gmail account used to send emails.
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                          Recipients
                        </p>
                        <div className="space-y-5">
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
                                setReviewerSettings((s) => ({ ...s, reviewer_1_email: e.target.value }))
                              }
                              placeholder="reviewer1@example.com"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            />
                          </div>
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
                                setReviewerSettings((s) => ({ ...s, reviewer_2_email: e.target.value }))
                              }
                              placeholder="reviewer2@example.com"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                      <SaveUI />
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    🔒 Email addresses are stored securely and only used server-side.
                  </p>
                </div>
              </div>
            )}

            {/* ── Outreach Emails ──────────────────────────────────── */}
            {activeSection === "outreach" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
                      <Globe className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Outreach Emails</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Configure the CC address used on all outreach emails to partner sites.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-6">
                  {loadingSettings ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading settings…
                    </div>
                  ) : (
                    <div className="space-y-6 max-w-md">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                          CC Recipients
                        </p>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Outreach Email 1
                            <span className="ml-2 text-xs font-normal text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                              CC
                            </span>
                          </label>
                          <input
                            type="email"
                            value={reviewerSettings.outreach_email_1}
                            onChange={(e) =>
                              setReviewerSettings((s) => ({ ...s, outreach_email_1: e.target.value }))
                            }
                            placeholder="outreach@example.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                          />
                          <p className="mt-1 text-xs text-gray-400">
                            CC'd on every outreach email sent to a partner site.
                          </p>
                        </div>
                      </div>
                      <SaveUI />
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    🔒 The real email address is stored securely server-side.
                  </p>
                </div>
              </div>
            )}

            {/* ── Alina Account ────────────────────────────────────── */}
            {activeSection === "alina" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                      <Mail className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Alina Account</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Configure the alina@rehiring.net inbox used for partner &amp; order emails.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-6">
                  {loadingSettings ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading settings…
                    </div>
                  ) : (
                    <div className="space-y-6 max-w-md">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                          Account Details
                        </p>
                        <div className="space-y-5">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Alina Email Address
                            </label>
                            <input
                              type="email"
                              value={reviewerSettings.alina_email}
                              onChange={(e) =>
                                setReviewerSettings((s) => ({ ...s, alina_email: e.target.value }))
                              }
                              placeholder="alina@rehiring.net"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                            />
                            <p className="mt-1 text-xs text-gray-400">
                              The inbox email address used for partner and order communications.
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Gmail OAuth Refresh Token
                            </label>
                            <div className="relative">
                              <input
                                type={showToken ? "text" : "password"}
                                value={reviewerSettings.alina_refresh_token}
                                onChange={(e) =>
                                  setReviewerSettings((s) => ({ ...s, alina_refresh_token: e.target.value }))
                                }
                                placeholder="Paste OAuth refresh token…"
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => setShowToken((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                              Generate via Google OAuth Playground using the alina@rehiring.net Google account.
                              Scope: <code className="bg-gray-100 px-1 rounded">https://mail.google.com/</code>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                        reviewerSettings.alina_refresh_token
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                          reviewerSettings.alina_refresh_token ? "bg-green-500" : "bg-amber-400"
                        }`} />
                        {reviewerSettings.alina_refresh_token
                          ? "Alina account configured — inbox is active"
                          : "OAuth token not set — Alina Inbox will show as unconfigured"}
                      </div>

                      <SaveUI />
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    🔒 The OAuth token is stored securely server-side and never sent to the browser after saving.
                  </p>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}
