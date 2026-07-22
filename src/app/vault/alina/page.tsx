// src/app/vault/alina/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  Send, RefreshCw, ChevronLeft, Search, X, Loader2,
  Mail, AlertCircle, MessageSquare, Clock, Bell,
  Settings, Users, ShoppingBag,
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
  sender: string; // "You" | "Partner" | "FatJoe Team"
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

type TabType = "partners" | "orders";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24 && d.toDateString() === now.toDateString()) return `${diffHours}h ago`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  if (d.getFullYear() === now.getFullYear())
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateFull(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function needsReply(t: ThreadSummary): boolean {
  return t.sender === "Partner" || t.sender === "FatJoe Team";
}

function senderBubbleClass(sender: string): string {
  if (sender === "You") return "bg-purple-600 text-white self-end rounded-br-none";
  if (sender === "FatJoe Team") return "bg-blue-50 text-gray-900 self-start rounded-bl-none";
  return "bg-gray-100 text-gray-900 self-start rounded-bl-none"; // Partner
}

function senderLabelClass(sender: string): string {
  if (sender === "You") return "text-purple-400";
  if (sender === "FatJoe Team") return "text-blue-600";
  return "text-gray-500"; // Partner
}

function statusChip(t: ThreadSummary) {
  if (needsReply(t)) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <Bell className="h-2.5 w-2.5" />
        Needs Reply
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
      <Clock className="h-2.5 w-2.5" />
      Awaiting
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AlinaPage() {
  const { role, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("partners");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threadsError, setThreadsError] = useState("");
  const [configured, setConfigured] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [selectedThread, setSelectedThread] = useState<ThreadDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState("");

  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Fetch threads ──────────────────────────────────────────────────────────

  const fetchThreads = useCallback(async (tab: TabType, q: string, replace = true) => {
    setLoadingThreads(true);
    setThreadsError("");
    try {
      const token = await getToken();
      const params = new URLSearchParams({ tab, ...(q ? { search: q } : {}) });
      const res = await fetch(`/api/vault/alina/threads?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      if (data.configured === false) {
        setConfigured(false);
        setThreads([]);
      } else {
        setConfigured(true);
        setThreads(replace ? data.threads : (prev) => [...prev, ...data.threads]);
        setNextPageToken(data.nextPageToken || null);
      }
    } catch (e: any) {
      setThreadsError(e.message);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    fetchThreads(activeTab, search);
    setSelectedThread(null);
  }, [activeTab, search, fetchThreads]);

  // ── Fetch thread detail ────────────────────────────────────────────────────

  const openThread = async (id: string) => {
    setLoadingThread(true);
    setThreadError("");
    setReplyBody("");
    setSendError("");
    setSendSuccess(false);
    try {
      const token = await getToken();
      const res = await fetch(`/api/vault/alina/threads/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load thread");
      setSelectedThread(data);
      setThreads((prev) => prev.map((t) => t.id === id ? { ...t, hasUnread: false } : t));
    } catch (e: any) {
      setThreadError(e.message);
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (selectedThread) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [selectedThread]);

  // ── Send reply ─────────────────────────────────────────────────────────────

  const handleReply = async () => {
    if (!selectedThread || !replyBody.trim()) return;
    setSending(true);
    setSendError("");
    setSendSuccess(false);
    try {
      const token = await getToken();
      const res = await fetch(`/api/vault/alina/threads/${selectedThread.threadId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: replyBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setSendSuccess(true);
      setReplyBody("");
      setTimeout(() => {
        openThread(selectedThread.threadId);
        setSendSuccess(false);
      }, 1200);
    } catch (e: any) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  // ── Auth guard ─────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (role !== "admin" && role !== "employee") return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Alina Inbox</h1>
              <p className="text-xs text-gray-400">alina@rehiring.net</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchThreads(activeTab, search)}
              disabled={loadingThreads}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingThreads ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left panel — thread list */}
        <div className="w-80 flex-shrink-0 border-r bg-white flex flex-col">
          {/* Tabs */}
          <div className="flex border-b px-3 pt-3 gap-1">
            {(["partners", "orders"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition-colors capitalize ${
                  activeTab === tab
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {tab === "partners" ? <Users className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}
                {tab === "partners" ? "Partners" : "Orders"}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="px-3 py-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(""); setSearch(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {!configured ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                <Settings className="h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500 font-medium">Alina account not connected</p>
                <p className="text-xs text-gray-400">Add the OAuth refresh token in Settings → Alina Account</p>
                <a
                  href="/vault/settings"
                  className="text-xs text-purple-600 hover:underline font-medium"
                >
                  Go to Settings →
                </a>
              </div>
            ) : loadingThreads && threads.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : threadsError ? (
              <div className="flex items-center gap-2 text-sm text-red-600 px-4 py-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {threadsError}
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-center px-4">
                <MessageSquare className="h-8 w-8 text-gray-200" />
                <p className="text-sm text-gray-400">No {activeTab} conversations yet</p>
              </div>
            ) : (
              <>
                {threads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openThread(t.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      selectedThread?.threadId === t.id ? "bg-purple-50 border-l-2 border-l-purple-500" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={`text-sm font-semibold truncate flex-1 ${t.hasUnread ? "text-gray-900" : "text-gray-600"}`}>
                        {t.subject}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                        {relativeTime(t.date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-400 truncate flex-1">{t.snippet}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {t.hasUnread && (
                          <span className="h-2 w-2 rounded-full bg-purple-500 flex-shrink-0" />
                        )}
                        {statusChip(t)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-gray-400">
                        {t.sender} · {t.messageCount} msg{t.messageCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </button>
                ))}
                {nextPageToken && (
                  <button
                    onClick={() => fetchThreads(activeTab, search, false)}
                    disabled={loadingThreads}
                    className="w-full py-3 text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors"
                  >
                    {loadingThreads ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right panel — thread detail */}
        <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
          {!selectedThread ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-gray-200 shadow-sm">
                <Mail className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">Select a conversation</p>
              <p className="text-xs text-gray-400">
                {activeTab === "partners" ? "Partner emails will appear here" : "FatJoe orders will appear here"}
              </p>
            </div>
          ) : loadingThread ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : threadError ? (
            <div className="flex items-center gap-2 text-sm text-red-600 p-6">
              <AlertCircle className="h-4 w-4" />
              {threadError}
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="border-b bg-white px-6 py-4 flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => setSelectedThread(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors md:hidden"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 truncate">
                    {selectedThread.subject}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {selectedThread.messages.length} message{selectedThread.messages.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {selectedThread.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "You" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${senderBubbleClass(msg.sender)}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[11px] font-semibold ${senderLabelClass(msg.sender)}`}>
                          {msg.sender}
                        </span>
                        <span className="text-[10px] text-gray-400">{fmtDateFull(msg.date)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Reply box */}
              <div className="border-t bg-white px-6 py-4 flex-shrink-0">
                {sendSuccess ? (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
                    <Send className="h-4 w-4" />
                    Reply sent from Alina!
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write reply as Alina…"
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply();
                      }}
                    />
                    {sendError && (
                      <div className="flex items-center gap-2 text-xs text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {sendError}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">⌘+Enter to send</span>
                      <button
                        onClick={handleReply}
                        disabled={sending || !replyBody.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {sending ? "Sending…" : "Reply as Alina"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
