"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Mail,
  Send,
  Paperclip,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Globe,
  Check,
  Clock,
  Settings,
  CornerDownLeft,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VaultItem {
  id: number;
  website_url: string;
  accepted: string;
  gmail_thread_id: string | null;
  partner_email: string | null;
  introduced_at: string | null;
  date_added: string | null;
}

interface ThreadMessage {
  id: string;
  date: string;
  dateMs: number;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  snippet: string;
  isOutbound: boolean;
  attachments: Array<{ filename: string; mimeType: string; attachmentId: string }>;
  labelIds: string[];
}

interface EmailTemplate {
  subject: string;
  body: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<{ filename: string; mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ filename: file.name, mimeType: file.type || "application/octet-stream", data: result.split(",")[1] });
    };
    reader.onerror = reject;
  });
}

function formatDate(dateStr: string | null | undefined, dateMs?: number): string {
  if (!dateStr && !dateMs) return "";
  const d = dateMs ? new Date(dateMs) : new Date(dateStr!);
  if (isNaN(d.getTime())) return dateStr ?? "";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function senderInitial(from: string): string {
  const name = from.replace(/<.*>/, "").trim();
  return (name[0] ?? "?").toUpperCase();
}

function senderName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim();
  return from.replace(/<|>/g, "").trim();
}

// ─── AttachmentPreview ────────────────────────────────────────────────────────

function AttachmentChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);
  return (
    <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1 text-xs text-gray-700 group">
      {preview ? (
        <img src={preview} alt={file.name} className="h-6 w-6 rounded object-cover" />
      ) : (
        <Paperclip className="h-3 w-3 text-gray-400" />
      )}
      <span className="max-w-[120px] truncate">{file.name}</span>
      <button onClick={onRemove} className="ml-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── MessageCard ──────────────────────────────────────────────────────────────

function MessageCard({ msg, defaultExpanded }: { msg: ThreadMessage; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`rounded-xl border transition-all ${
        msg.isOutbound
          ? "bg-blue-50 border-blue-100"
          : "bg-white border-gray-200 shadow-sm"
      }`}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white ${
            msg.isOutbound ? "bg-blue-500" : "bg-gray-500"
          }`}
        >
          {senderInitial(msg.from)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-gray-800 text-sm truncate">
              {senderName(msg.from)}
            </span>
            <span className="flex-shrink-0 text-xs text-gray-400">
              {formatDate(msg.date, msg.dateMs)}
            </span>
          </div>
          {!expanded && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{msg.snippet}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-gray-400 mt-0.5">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4">
          {/* To/CC meta */}
          <div className="text-xs text-gray-400 mb-3 pl-11 space-y-0.5">
            <div><span className="font-medium">To:</span> {msg.to}</div>
            {msg.cc && <div><span className="font-medium">Cc:</span> {msg.cc}</div>}
          </div>
          {/* Body */}
          <div className="pl-11">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
              {msg.body || msg.snippet}
            </pre>
          </div>
          {/* Attachments */}
          {msg.attachments.length > 0 && (
            <div className="pl-11 mt-3 flex flex-wrap gap-2">
              {msg.attachments.map((att) => (
                <div key={att.attachmentId} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1 text-xs text-gray-700">
                  <Paperclip className="h-3 w-3 text-gray-400" />
                  <span>{att.filename}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ComposeArea (new intro, no thread yet) ───────────────────────────────────

function ComposeArea({
  item,
  template,
  onSent,
}: {
  item: VaultItem;
  template: EmailTemplate | null;
  onSent: (updatedItem: Partial<VaultItem>) => void;
}) {
  const domain = item.website_url;
  const [to, setTo] = useState(item.partner_email ?? "");
  const [subject, setSubject] = useState(
    template ? template.subject.replace(/{domain}/g, domain) : `Introduction: ${domain}`
  );
  const [body, setBody] = useState(
    template
      ? template.body.replace(/{domain}/g, domain)
      : `Hi,\n\nI wanted to reach out about ${domain}. We'd love to explore a collaboration opportunity.\n\nPlease let me know if you're interested!\n\nBest regards,\nRavi`
  );
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-fill if template loaded after mount
  useEffect(() => {
    if (template && !item.partner_email) {
      setSubject(template.subject.replace(/{domain}/g, domain));
      setBody(template.body.replace(/{domain}/g, domain));
    }
  }, [template]);

  async function handleSend() {
    if (!to.trim()) { setError("Partner email is required"); return; }
    setSending(true);
    setError("");
    try {
      const attachments = await Promise.all(files.map(fileToBase64));
      const res = await fetch(`/api/vault/introductions/${item.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject, body, attachments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      onSent({ partner_email: to.trim(), gmail_thread_id: data.threadId });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-0 border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">New Introduction</span>
        <span className="text-xs text-gray-400">{domain}</span>
      </div>

      {/* To */}
      <div className="flex items-center px-4 py-2.5 border-b border-gray-100 gap-2">
        <span className="text-xs text-gray-400 w-12">To</span>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="partner@theirsite.com"
          className="flex-1 text-sm outline-none placeholder-gray-300"
        />
      </div>

      {/* CC — masked */}
      <div className="flex items-center px-4 py-2.5 border-b border-gray-100 gap-2">
        <span className="text-xs text-gray-400 w-12">Cc</span>
        <div className="flex gap-2">
          <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2.5 py-0.5">Client Contact 1</span>
          <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2.5 py-0.5">Client Contact 2</span>
        </div>
      </div>

      {/* Subject */}
      <div className="flex items-center px-4 py-2.5 border-b border-gray-100 gap-2">
        <span className="text-xs text-gray-400 w-12">Subject</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="flex-1 text-sm outline-none"
        />
      </div>

      {/* Body */}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={10}
        className="px-4 py-3 text-sm text-gray-700 resize-none outline-none font-sans leading-relaxed"
        placeholder="Write your introduction email..."
      />

      {/* Attachments preview */}
      {files.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <AttachmentChip key={i} file={f} onRemove={() => setFiles((prev) => prev.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
        <button
          onClick={() => handleSend()}
          disabled={sending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "Sending…" : "Send Introduction"}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Paperclip className="h-4 w-4" />
          Attach
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
            e.target.value = "";
          }}
        />

        {error && <p className="text-xs text-red-500 ml-auto">{error}</p>}
      </div>
    </div>
  );
}

// ─── ReplyBox ─────────────────────────────────────────────────────────────────

function ReplyBox({
  item,
  template,
  onSent,
}: {
  item: VaultItem;
  template: EmailTemplate | null;
  onSent: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState(
    template
      ? template.body.replace(/{domain}/g, item.website_url)
      : `Hi,\n\nJust following up on my previous email about ${item.website_url}. Would love to connect!\n\nBest regards,\nRavi`
  );
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (template) {
      setBody(template.body.replace(/{domain}/g, item.website_url));
    }
  }, [template]);

  async function handleSend() {
    setSending(true);
    setError("");
    setSuccess(false);
    try {
      const attachments = await Promise.all(files.map(fileToBase64));
      const res = await fetch(`/api/vault/introductions/${item.id}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body, attachments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setSuccess(true);
      setFiles([]);
      setExpanded(false);
      onSent();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-400 transition-colors shadow-sm"
      >
        <CornerDownLeft className="h-4 w-4" />
        <span>Reply or send a follow-up…</span>
        {success && <span className="ml-auto text-xs text-green-600 font-medium">✓ Sent</span>}
      </button>
    );
  }

  return (
    <div className="border border-blue-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Follow-up</span>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>To: {item.partner_email}</span>
          <span>·</span>
          <span>Cc: Client Contact 1, 2</span>
        </div>
      </div>

      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={7}
        className="w-full px-4 py-3 text-sm text-gray-700 resize-none outline-none font-sans leading-relaxed"
        placeholder="Write your follow-up..."
      />

      {files.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <AttachmentChip key={i} file={f} onRemove={() => setFiles((prev) => prev.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
        <button
          onClick={handleSend}
          disabled={sending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "Sending…" : "Send Follow-up"}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm px-2 py-1 rounded-lg hover:bg-gray-100"
        >
          <Paperclip className="h-4 w-4" />
          Attach
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
            e.target.value = "";
          }}
        />

        <button onClick={() => setExpanded(false)} className="ml-auto text-xs text-gray-400 hover:text-gray-600">
          Discard
        </button>

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

// ─── DomainListItem ───────────────────────────────────────────────────────────

function DomainListItem({
  item,
  selected,
  onClick,
}: {
  item: VaultItem;
  selected: boolean;
  onClick: () => void;
}) {
  const introduced = !!item.gmail_thread_id;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
        selected ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
      }`}
    >
      {/* Status dot */}
      <div className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${introduced ? "bg-green-500" : "bg-amber-400"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-medium text-gray-800 truncate">{item.website_url}</span>
          <span className="flex-shrink-0 text-xs text-gray-400">
            {item.introduced_at
              ? formatDate(item.introduced_at)
              : item.date_added
              ? formatDate(item.date_added)
              : ""}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {introduced
            ? item.partner_email ?? "Introduced"
            : "No intro sent yet"}
        </p>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IntroductionsPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "introduced">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Thread
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Templates
  const [introTemplate, setIntroTemplate] = useState<EmailTemplate | null>(null);
  const [followupTemplate, setFollowupTemplate] = useState<EmailTemplate | null>(null);

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  // Load vault items
  useEffect(() => {
    fetch("/api/vault/items?accepted=Y")
      .then((r) => r.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : data.items ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load templates
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/vault/templates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const intro = data.find((t: { type: string; subject: string; body: string }) => t.type === "intro");
          const followup = data.find((t: { type: string; subject: string; body: string }) => t.type === "followup");
          if (intro) setIntroTemplate({ subject: intro.subject, body: intro.body });
          if (followup) setFollowupTemplate({ subject: followup.subject, body: followup.body });
        }
      })
      .catch(console.error);
  }, [isAdmin]);

  // Load thread when domain selected
  useEffect(() => {
    if (!selectedId || !isAdmin) return;
    setThread([]);
    setThreadError("");
    setThreadLoading(true);
    fetch(`/api/vault/introductions/${selectedId}/thread`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setThread(data.messages ?? []);
        // Update partner_email in local state if returned
        if (data.partnerEmail) {
          setItems((prev) =>
            prev.map((i) => (i.id === selectedId ? { ...i, partner_email: data.partnerEmail } : i))
          );
        }
      })
      .catch((e) => setThreadError(e.message))
      .finally(() => setThreadLoading(false));
  }, [selectedId, isAdmin]);

  // Scroll to bottom of thread when new messages load
  useEffect(() => {
    if (thread.length > 0) {
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [thread]);

  function refreshThread() {
    if (!selectedId) return;
    setThreadLoading(true);
    fetch(`/api/vault/introductions/${selectedId}/thread`)
      .then((r) => r.json())
      .then((data) => setThread(data.messages ?? []))
      .catch(console.error)
      .finally(() => setThreadLoading(false));
  }

  function handleSent(updatedFields: Partial<VaultItem>) {
    setItems((prev) =>
      prev.map((i) => (i.id === selectedId ? { ...i, ...updatedFields } : i))
    );
    // Reload thread
    setTimeout(() => refreshThread(), 1000);
  }

  // Filter + search
  const filtered = items.filter((i) => {
    const matchSearch = i.website_url.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "introduced" && !!i.gmail_thread_id) ||
      (filter === "pending" && !i.gmail_thread_id);
    return matchSearch && matchFilter;
  });

  const pendingCount = items.filter((i) => !i.gmail_thread_id).length;
  const introducedCount = items.filter((i) => !!i.gmail_thread_id).length;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white overflow-hidden">
      {/* ── Left sidebar ── */}
      <div className="w-72 xl:w-80 border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Sidebar header */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-base font-semibold text-gray-800">Introductions</h1>
            {isAdmin && (
              <a
                href="/introductions/templates"
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Manage templates"
              >
                <Settings className="h-4 w-4" />
              </a>
            )}
          </div>
          {/* Stats */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              {pendingCount} pending
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              {introducedCount} introduced
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search domains…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-gray-100">
          {(["all", "pending", "introduced"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Domain list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">No domains found</p>
          ) : (
            filtered.map((item) => (
              <DomainListItem
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onClick={() => setSelectedId(item.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedItem ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Mail className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select a domain to view its conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Panel header */}
            <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-gray-400" />
                <div>
                  <h2 className="font-semibold text-gray-800 text-sm">{selectedItem.website_url}</h2>
                  {selectedItem.partner_email && isAdmin && (
                    <p className="text-xs text-gray-400">{selectedItem.partner_email}</p>
                  )}
                </div>
                {selectedItem.gmail_thread_id ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-0.5">
                    <Check className="h-3 w-3" /> Introduced
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-0.5">
                    <Clock className="h-3 w-3" /> Pending
                  </span>
                )}
              </div>
              {selectedItem.gmail_thread_id && isAdmin && (
                <button
                  onClick={refreshThread}
                  disabled={threadLoading}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh thread"
                >
                  <RefreshCw className={`h-4 w-4 ${threadLoading ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>

            {/* Thread content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {/* Viewer: no email content shown */}
              {!isAdmin ? (
                <div className="flex items-center justify-center py-20">
                  <p className="text-sm text-gray-400">Email content visible to admins only.</p>
                </div>
              ) : selectedItem.gmail_thread_id ? (
                /* Thread messages */
                threadLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                  </div>
                ) : threadError ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {threadError}
                  </div>
                ) : thread.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No messages yet — try refreshing.</p>
                ) : (
                  <>
                    {thread.map((msg, i) => (
                      <MessageCard
                        key={msg.id}
                        msg={msg}
                        defaultExpanded={i === 0 || i === thread.length - 1}
                      />
                    ))}
                    <div ref={threadEndRef} />
                  </>
                )
              ) : (
                /* New intro compose */
                <ComposeArea
                  item={selectedItem}
                  template={introTemplate}
                  onSent={(updated) => handleSent(updated)}
                />
              )}
            </div>

            {/* Reply box — only when thread exists and admin */}
            {isAdmin && selectedItem.gmail_thread_id && !threadLoading && (
              <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
                <ReplyBox
                  item={selectedItem}
                  template={followupTemplate}
                  onSent={() => {
                    setTimeout(() => refreshThread(), 1500);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
