// src/app/vault/communications/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  Send,
  Settings,
  PenSquare,
  RefreshCw,
  ChevronLeft,
  Search,
  X,
  Loader2,
  Mail,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  date: string;
  sender: string;
  messageCount: number;
  hasUnread: boolean;
}

interface Message {
  id: string;
  subject: string;
  sender: string;
  date: string;
  body: string;
}

interface ThreadDetail {
  threadId: string;
  subject: string;
  messages: Message[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.getFullYear() === now.getFullYear())
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateFull(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function senderChip(sender: string): string {
  if (sender === "Reviewer 1") return "bg-blue-100 text-blue-800";
  if (sender === "Reviewer 2") return "bg-purple-100 text-purple-800";
  return "bg-gray-100 text-gray-700";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommunicationsPage() {
  const { role, loading: authLoading } = useAuth();

  // Thread list
  const [search, setSearch] = useState("");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [configured, setConfigured] = useState(true);

  // Thread detail
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);

  // Compose
  const [composeOpen, setComposeOpen] = useState(false);
  const [cSubject, setCSubject] = useState("");
  const [cBody, setCBody] = useState("");
  const [sending, setSending] = useState(false);
  const [composeErr, setComposeErr] = useState("");

  // Reply
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyErr, setReplyErr] = useState("");

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [r1Email, setR1Email] = useState("");
  const [r2Email, setR2Email] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");

  // ── Fetch threads ───────────────────────────────────────────────────────────

  const fetchThreads = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/vault/communications/threads?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setListError(`Error ${res.status}: ${data.error || "Unknown error"}`);
        return;
      }
      setThreads(data.threads || []);
      setConfigured(data.configured !== false);
    } catch (e: any) {
      setListError(`Failed: ${e.message}`);
    } finally {
      setListLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // ── Fetch thread detail ─────────────────────────────────────────────────────

  const fetchThread = useCallback(async (threadId: string) => {
    setThreadLoading(true);
    setThreadDetail(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/vault/communications/threads/${threadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setThreadDetail(await res.json());
      setThreads((prev) =>
        prev.map((t) => t.id === threadId ? { ...t, hasUnread: false } : t)
      );
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const selectThread = (threadId: string) => {
    setSelectedId(threadId);
    setReplyBody("");
    setReplyErr("");
    setMobileDetail(true);
    fetchThread(threadId);
  };

  // ── Send new email ──────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!cSubject.trim() || !cBody.trim()) {
      setComposeErr("Subject and body are required.");
      return;
    }
    setSending(true);
    setComposeErr("");
    try {
      const token = await getToken();
      const res = await fetch("/api/vault/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: cSubject, body: cBody }),
      });
      const data = await res.json();
      if (!res.ok) { setComposeErr(data.error || "Failed to send."); return; }
      setComposeOpen(false);
      setCSubject("");
      setCBody("");
      setTimeout(fetchThreads, 1500); // give Gmail a moment to index
    } finally {
      setSending(false);
    }
  };

  // ── Reply ───────────────────────────────────────────────────────────────────

  const handleReply = async () => {
    if (!replyBody.trim() || !selectedId) return;
    setReplying(true);
    setReplyErr("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/vault/communications/threads/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: replyBody }),
      });
      const data = await res.json();
      if (!res.ok) { setReplyErr(data.error || "Failed to send reply."); return; }
      setReplyBody("");
      fetchThread(selectedId);
    } finally {
      setReplying(false);
    }
  };

  // ── Settings ────────────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    const token = await getToken();
    const res = await fetch("/api/vault/communications/settings", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const d = await res.json();
      setR1Email(d.reviewer_1_email || "");
      setR2Email(d.reviewer_2_email || "");
    }
  }, []);

  useEffect(() => { if (settingsOpen) loadSettings(); }, [settingsOpen, loadSettings]);

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsMsg("");
    try {
      const token = await getToken();
      const res = await fetch("/api/vault/communications/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reviewer_1_email: r1Email, reviewer_2_email: r2Email }),
      });
      const data = await res.json();
      setSettingsMsg(res.ok ? "Saved!" : data.error || "Failed.");
      if (res.ok) { setConfigured(true); fetchThreads(); }
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const unreadCount = threads.filter((t) => t.hasUnread).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ height: "calc(100vh - 73px)" }}>
      <div className="flex flex-1 overflow-hidden h-full">

        {/* ── Thread list panel ──────────────────────────────────────────────── */}
        <div className={`w-80 bg-white border-r flex-shrink-0 flex flex-col ${mobileDetail ? "hidden md:flex" : "flex"}`}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-800">Conversations</span>
              {unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {role === "admin" && (
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={fetchThreads}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => { setComposeOpen(true); setComposeErr(""); }}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ml-1"
              >
                <PenSquare className="h-3.5 w-3.5" />
                Compose
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-8 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {listError ? (
              <div className="m-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 break-all">
                {listError}
              </div>
            ) : listLoading && threads.length === 0 ? (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : !configured ? (
              <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
                <AlertCircle className="h-8 w-8 text-amber-400" />
                <p className="text-sm text-gray-500">Reviewer emails not configured.</p>
                {role === "admin" && (
                  <button onClick={() => setSettingsOpen(true)} className="text-xs text-blue-600 hover:underline">
                    Configure in Settings →
                  </button>
                )}
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center gap-2">
                <Mail className="h-10 w-10 text-gray-200" />
                <p className="text-sm text-gray-400">No conversations yet</p>
              </div>
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectThread(t.id)}
                  className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-gray-50 ${
                    selectedId === t.id ? "bg-blue-50 border-l-[3px] border-l-blue-600" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-sm truncate max-w-[65%] ${t.hasUnread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                      {t.subject || "(no subject)"}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{fmtDate(t.date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.hasUnread && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
                    <span className="text-xs text-gray-400 truncate">{t.snippet}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${senderChip(t.sender)}`}>
                      {t.sender}
                    </span>
                    {t.messageCount > 1 && (
                      <span className="text-[10px] text-gray-400">{t.messageCount} messages</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Thread detail panel ────────────────────────────────────────────── */}
        <div className={`flex-1 flex flex-col bg-white min-w-0 ${!mobileDetail && !selectedId ? "hidden md:flex" : "flex"}`}>
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
              <MessageSquare className="h-14 w-14 text-gray-200" />
              <p className="text-gray-400 text-sm">Select a conversation to read</p>
            </div>
          ) : threadLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : threadDetail ? (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 border-b px-6 py-4">
                <button onClick={() => { setMobileDetail(false); setSelectedId(null); }} className="md:hidden text-gray-400 hover:text-gray-700">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="flex-1 text-base font-semibold text-gray-900 truncate">{threadDetail.subject}</h2>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {threadDetail.messages.length} {threadDetail.messages.length === 1 ? "message" : "messages"}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {threadDetail.messages.map((msg) => (
                  <div key={msg.id} className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${senderChip(msg.sender)}`}>
                        {msg.sender}
                      </span>
                      <span className="text-xs text-gray-400">{fmtDateFull(msg.date)}</span>
                    </div>
                    <div className="px-4 py-4 bg-white">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {msg.body || "(empty message)"}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              <div className="border-t bg-white p-4">
                <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-shadow">
                  <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                    <span>To: <span className="font-semibold text-gray-700">Reviewer 1</span></span>
                    <span className="text-gray-300">|</span>
                    <span>CC: <span className="font-semibold text-gray-700">Reviewer 2</span></span>
                  </div>
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write a reply…"
                    rows={3}
                    className="w-full px-4 py-3 text-sm text-gray-700 focus:outline-none resize-none bg-white"
                  />
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
                    <span className="text-xs text-red-500">{replyErr}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setReplyBody(""); setReplyErr(""); }}
                        disabled={!replyBody}
                        className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleReply}
                        disabled={!replyBody.trim() || replying}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {replying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Send Reply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Compose modal ─────────────────────────────────────────────────────── */}
      {composeOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-900 rounded-t-2xl">
              <h3 className="text-sm font-semibold text-white">New Message</h3>
              <button onClick={() => setComposeOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 px-5 py-2.5 border-b">
                <span className="text-xs text-gray-400 w-6">To</span>
                <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">Reviewer 1</span>
              </div>
              <div className="flex items-center gap-3 px-5 py-2.5 border-b">
                <span className="text-xs text-gray-400 w-6">CC</span>
                <span className="text-xs font-semibold bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full">Reviewer 2</span>
              </div>
              <input
                value={cSubject}
                onChange={(e) => setCSubject(e.target.value)}
                placeholder="Subject"
                className="px-5 py-3 text-sm font-medium text-gray-900 border-b focus:outline-none placeholder:text-gray-400"
              />
              <textarea
                value={cBody}
                onChange={(e) => setCBody(e.target.value)}
                placeholder="Write your message…"
                rows={10}
                className="flex-1 px-5 py-4 text-sm text-gray-700 focus:outline-none resize-none placeholder:text-gray-400"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50">
              {composeErr ? <p className="text-xs text-red-600">{composeErr}</p> : <span />}
              <div className="flex items-center gap-2">
                <button onClick={() => setComposeOpen(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
                  Discard
                </button>
                <button
                  onClick={handleSend}
                  disabled={!cSubject.trim() || !cBody.trim() || sending}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings modal ─────────────────────────────────────────────────────── */}
      {settingsOpen && role === "admin" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-base font-semibold text-gray-900">Reviewer Settings</h3>
              <button onClick={() => { setSettingsOpen(false); setSettingsMsg(""); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500">
                Real emails are never shown to users — aliased as <strong>Reviewer 1</strong> (TO) and <strong>Reviewer 2</strong> (CC).
              </p>
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1.5">
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Reviewer 1</span>
                  <span className="text-gray-400 font-normal">— TO</span>
                </label>
                <input
                  type="email"
                  value={r1Email}
                  onChange={(e) => setR1Email(e.target.value)}
                  placeholder="reviewer1@example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1.5">
                  <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">Reviewer 2</span>
                  <span className="text-gray-400 font-normal">— CC</span>
                </label>
                <input
                  type="email"
                  value={r2Email}
                  onChange={(e) => setR2Email(e.target.value)}
                  placeholder="reviewer2@example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {settingsMsg && (
                <p className={`text-xs font-medium ${settingsMsg === "Saved!" ? "text-green-600" : "text-red-600"}`}>
                  {settingsMsg}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t bg-gray-50">
              <button onClick={() => { setSettingsOpen(false); setSettingsMsg(""); }} className="text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                {savingSettings && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
