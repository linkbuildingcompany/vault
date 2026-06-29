"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Mail,
  CheckCircle,
  Loader2,
  MessageSquare,
  X,
  Send,
  RefreshCw,
  Settings,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VaultItem } from "@/lib/supabase";

interface ThreadMessage {
  id: string;
  snippet: string;
  date: string;
  from: string;
  to: string;
  subject: string;
  labelIds: string[];
}

interface EmailTemplate {
  subject: string;
  body: string;
}

interface Templates {
  intro?: EmailTemplate;
  followup?: EmailTemplate;
}

// ─── Compose Modal ────────────────────────────────────────────────────────────
function ComposeModal({
  item,
  template,
  onSend,
  onClose,
}: {
  item: VaultItem;
  template: EmailTemplate;
  onSend: (subject: string, body: string) => Promise<void>;
  onClose: () => void;
}) {
  const domain = item.website_url;
  const [subject, setSubject] = useState(
    template.subject.replace(/{domain}/g, domain)
  );
  const [body, setBody] = useState(
    template.body.replace(/{domain}/g, domain)
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    setSending(true);
    setError("");
    try {
      await onSend(subject, body);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <p className="font-semibold text-gray-800">Send Introduction</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{domain}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Meta */}
        <div className="px-5 py-3 border-b bg-gray-50 space-y-1.5 text-xs text-gray-500">
          <div className="flex gap-2">
            <span className="font-medium w-6 shrink-0">To:</span>
            <span className="text-gray-700">Client Contact 1</span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium w-6 shrink-0">CC:</span>
            <span className="text-gray-700">Client Contact 2</span>
          </div>
        </div>

        {/* Compose */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed resize-y"
            />
          </div>
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-gray-50">
          <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send Email
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Templates Manager ────────────────────────────────────────────────────────
function TemplatesManager({ onBack }: { onBack: () => void }) {
  const [templates, setTemplates] = useState<Templates>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Editable state
  const [introSubject, setIntroSubject] = useState("");
  const [introBody, setIntroBody] = useState("");
  const [followupSubject, setFollowupSubject] = useState("");
  const [followupBody, setFollowupBody] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/vault/templates");
      const data: Templates = await res.json();
      setTemplates(data);
      setIntroSubject(data.intro?.subject ?? "Introduction: {domain}");
      setIntroBody(
        data.intro?.body ??
          "Hi Betty,\n\nI wanted to introduce you to {domain} — they have a great audience and I think they'd be a fantastic fit for a collaboration.\n\nPlease let me know if you'd like to connect!\n\nBest regards,\nRavi"
      );
      setFollowupSubject(data.followup?.subject ?? "Re: Introduction: {domain}");
      setFollowupBody(
        data.followup?.body ??
          "Hi Betty,\n\nJust following up on the introduction I sent for {domain}. Please let me know if you have any questions!\n\nBest regards,\nRavi"
      );
    } catch {
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  async function saveTemplate(id: "intro" | "followup") {
    setSaving(id);
    setError("");
    setSaved(null);
    try {
      const subject = id === "intro" ? introSubject : followupSubject;
      const body = id === "intro" ? introBody : followupBody;
      const res = await fetch("/api/vault/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, subject, body }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Save failed");
      }
      setSaved(id);
      setTimeout(() => setSaved(null), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Email Templates</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Use <code className="bg-gray-100 px-1 rounded text-xs">{"{domain}"}</code> as a placeholder — it gets replaced with the actual domain when sending.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Intro Template */}
      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Introduction Email</p>
            <p className="text-xs text-gray-400 mt-0.5">Sent when you click "Send Intro" on a domain</p>
          </div>
          <Button
            size="sm"
            onClick={() => saveTemplate("intro")}
            disabled={saving === "intro"}
            className="gap-1.5"
          >
            {saving === "intro" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saved === "intro" ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : null}
            {saved === "intro" ? "Saved!" : "Save"}
          </Button>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Subject</label>
          <input
            type="text"
            value={introSubject}
            onChange={(e) => setIntroSubject(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Body</label>
          <textarea
            value={introBody}
            onChange={(e) => setIntroBody(e.target.value)}
            rows={10}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
      </div>

      {/* Follow-up Template */}
      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Follow-up Email</p>
            <p className="text-xs text-gray-400 mt-0.5">Pre-filled when you click "Send Follow-up" in a thread</p>
          </div>
          <Button
            size="sm"
            onClick={() => saveTemplate("followup")}
            disabled={saving === "followup"}
            className="gap-1.5"
          >
            {saving === "followup" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saved === "followup" ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : null}
            {saved === "followup" ? "Saved!" : "Save"}
          </Button>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Subject (auto-prefixed with Re:)</label>
          <input
            type="text"
            value={followupSubject}
            onChange={(e) => setFollowupSubject(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Re: Introduction: {domain}"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Body</label>
          <textarea
            value={followupBody}
            onChange={(e) => setFollowupBody(e.target.value)}
            rows={8}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IntroductionsPage() {
  const { role, loading } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [templates, setTemplates] = useState<Templates>({});
  const [showTemplates, setShowTemplates] = useState(false);

  // Compose modal state
  const [composeItem, setComposeItem] = useState<VaultItem | null>(null);

  // Thread panel state
  const [panelItem, setPanelItem] = useState<VaultItem | null>(null);
  const [threadMsgs, setThreadMsgs] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");

  // Follow-up compose state
  const [followupBody, setFollowupBody] = useState("");
  const [sendingFollowup, setSendingFollowup] = useState(false);

  const [actionError, setActionError] = useState<Record<number, string>>({});

  const isAdmin = role === "admin";

  useEffect(() => {
    if (!loading) {
      fetchData();
      fetchTemplates();
    }
  }, [loading]);

  async function fetchData() {
    setFetching(true);
    try {
      const res = await fetch("/api/vault/introductions");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setFetching(false);
    }
  }

  async function fetchTemplates() {
    try {
      const res = await fetch("/api/vault/templates");
      const data: Templates = await res.json();
      setTemplates(data);
    } catch {
      // silently use defaults
    }
  }

  function openCompose(item: VaultItem) {
    setComposeItem(item);
  }

  async function handleSendIntro(subject: string, body: string) {
    if (!composeItem) return;
    const id = composeItem.id;
    setActionError((prev) => ({ ...prev, [id]: "" }));
    const res = await fetch(`/api/vault/introductions/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send");
    await fetchData();
  }

  async function openThreadPanel(item: VaultItem) {
    setPanelItem(item);
    setThreadMsgs([]);
    setThreadError("");
    // Pre-fill follow-up body from template
    const domain = item.website_url;
    const tpl = templates.followup;
    setFollowupBody(
      tpl?.body.replace(/{domain}/g, domain) ??
        `Hi Betty,\n\nJust following up on the introduction I sent for ${domain}. Please let me know if you have any questions!\n\nBest regards,\nRavi`
    );
    if (!item.gmail_thread_id) return;
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/vault/introductions/${item.id}/thread`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load thread");
      setThreadMsgs(data.messages || []);
    } catch (err: unknown) {
      setThreadError(err instanceof Error ? err.message : String(err));
    } finally {
      setThreadLoading(false);
    }
  }

  async function handleSendFollowup() {
    if (!panelItem) return;
    setSendingFollowup(true);
    setThreadError("");
    try {
      const res = await fetch(
        `/api/vault/introductions/${panelItem.id}/followup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: followupBody }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send follow-up");
      // Refresh thread
      await openThreadPanel(panelItem);
    } catch (err: unknown) {
      setThreadError(err instanceof Error ? err.message : String(err));
    } finally {
      setSendingFollowup(false);
    }
  }

  function closePanel() {
    setPanelItem(null);
    setThreadMsgs([]);
    setThreadError("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Show templates manager
  if (showTemplates) {
    return <TemplatesManager onBack={() => { setShowTemplates(false); fetchTemplates(); }} />;
  }

  const pending = items.filter((i) => !i.introduced_at);
  const introduced = items.filter((i) => i.introduced_at);

  const defaultIntroTemplate: EmailTemplate = {
    subject: "Introduction: {domain}",
    body: "Hi Betty,\n\nI wanted to introduce you to {domain} — they have a great audience and I think they'd be a fantastic fit for a collaboration.\n\nPlease let me know if you'd like to connect!\n\nBest regards,\nRavi",
  };

  return (
    <>
      {/* Compose modal */}
      {composeItem && (
        <ComposeModal
          item={composeItem}
          template={templates.intro ?? defaultIntroTemplate}
          onSend={handleSendIntro}
          onClose={() => setComposeItem(null)}
        />
      )}

      <div className="relative flex">
        {/* Main content */}
        <main
          className={`mx-auto max-w-6xl px-6 py-8 space-y-6 transition-all duration-300 ${
            panelItem ? "w-[calc(100%-440px)]" : "w-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Partner Introductions
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {pending.length} pending · {introduced.length} introduced
              </p>
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowTemplates(true)}
              >
                <Settings className="h-3.5 w-3.5" />
                Templates
              </Button>
            )}
          </div>

          {fetching ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border bg-white px-6 py-16 text-center text-gray-400">
              No approved domains yet. Mark domains as &quot;Y&quot; in the
              Approval Queue first.
            </div>
          ) : (
            <div className="rounded-lg border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                      Domain
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">
                      Approved On
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 w-28">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 w-52">
                      {isAdmin ? "Action" : "Thread"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${
                        panelItem?.id === item.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-gray-800">
                        {item.website_url}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(item.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.introduced_at ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <CheckCircle className="h-3.5 w-3.5" /> Done
                          </span>
                        ) : (
                          <span className="text-xs text-yellow-600 font-medium">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && !item.introduced_at && (
                            <Button
                              size="sm"
                              className="gap-1.5 h-7 text-xs"
                              onClick={() => openCompose(item)}
                            >
                              <Mail className="h-3 w-3" />
                              Send Intro
                            </Button>
                          )}
                          {item.introduced_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-7 text-xs"
                              onClick={() => openThreadPanel(item)}
                            >
                              <MessageSquare className="h-3 w-3" />
                              Thread
                            </Button>
                          )}
                          {actionError[item.id] && (
                            <span className="text-xs text-red-500 max-w-[160px] truncate">
                              {actionError[item.id]}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t px-4 py-2 text-xs text-gray-400">
                Showing {items.length} approved domains
              </div>
            </div>
          )}
        </main>

        {/* Thread slide-out panel */}
        {panelItem && (
          <aside className="fixed top-0 right-0 h-full w-[440px] bg-white border-l shadow-xl z-40 flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                  Email Thread
                </p>
                <p className="font-mono text-sm font-semibold text-gray-800 mt-0.5 truncate max-w-[300px]">
                  {panelItem.website_url}
                </p>
              </div>
              <button
                onClick={closePanel}
                className="p-1.5 rounded hover:bg-gray-200 transition-colors"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Thread messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {threadLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : threadError ? (
                <div className="text-sm text-red-500 py-4">{threadError}</div>
              ) : threadMsgs.length === 0 ? (
                <div className="text-sm text-gray-400 py-4 text-center">
                  No messages yet.
                </div>
              ) : (
                threadMsgs.map((msg) => {
                  const isSent =
                    msg.labelIds.includes("SENT") ||
                    msg.from.toLowerCase().includes("ravi.soni4254");

                  return (
                    <div
                      key={msg.id}
                      className={`rounded-lg border px-4 py-3 text-sm space-y-1 ${
                        isSent
                          ? "bg-blue-50 border-blue-100"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            isSent
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {isSent ? "Sent" : "Reply"}
                        </span>
                        <span className="text-xs text-gray-400 truncate max-w-[220px]">
                          {msg.date}
                        </span>
                      </div>
                      <p className="text-gray-700 text-xs leading-relaxed line-clamp-4">
                        {msg.snippet}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Follow-up compose — admin only */}
            {isAdmin && (
              <div className="border-t px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600">Send Follow-up</p>
                  <button
                    onClick={() => openThreadPanel(panelItem)}
                    disabled={threadLoading}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                    title="Refresh thread"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${threadLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <textarea
                  value={followupBody}
                  onChange={(e) => setFollowupBody(e.target.value)}
                  rows={5}
                  placeholder="Type your follow-up message..."
                  className="w-full border rounded-lg px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {threadError && (
                  <p className="text-xs text-red-500">{threadError}</p>
                )}
                <Button
                  size="sm"
                  className="gap-1.5 w-full h-8 text-xs"
                  onClick={handleSendFollowup}
                  disabled={sendingFollowup || !followupBody.trim()}
                >
                  {sendingFollowup ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Send Follow-up
                </Button>
              </div>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
