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

export default function IntroductionsPage() {
  const { role, loading } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [fetching, setFetching] = useState(true);

  // Thread panel state
  const [panelItem, setPanelItem] = useState<VaultItem | null>(null);
  const [threadMsgs, setThreadMsgs] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");

  // Action states
  const [sending, setSending] = useState<number | null>(null);
  const [sendingFollowup, setSendingFollowup] = useState(false);
  const [actionError, setActionError] = useState<Record<number, string>>({});

  const isAdmin = role === "admin";

  useEffect(() => {
    if (!loading) fetchData();
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

  async function handleSendIntro(item: VaultItem) {
    setSending(item.id);
    setActionError((prev) => ({ ...prev, [item.id]: "" }));
    try {
      const res = await fetch(`/api/vault/introductions/${item.id}/send`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      // Refresh list
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError((prev) => ({ ...prev, [item.id]: msg }));
    } finally {
      setSending(null);
    }
  }

  async function openThreadPanel(item: VaultItem) {
    setPanelItem(item);
    setThreadMsgs([]);
    setThreadError("");
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
    try {
      const res = await fetch(
        `/api/vault/introductions/${panelItem.id}/followup`,
        { method: "POST" }
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

  const pending = items.filter((i) => !i.introduced_at);
  const introduced = items.filter((i) => i.introduced_at);

  return (
    <div className="relative flex">
      {/* Main content */}
      <main
        className={`mx-auto max-w-6xl px-6 py-8 space-y-6 transition-all duration-300 ${
          panelItem ? "w-[calc(100%-420px)]" : "w-full"
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
                            onClick={() => handleSendIntro(item)}
                            disabled={sending === item.id}
                          >
                            {sending === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Mail className="h-3 w-3" />
                            )}
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
        <aside className="fixed top-0 right-0 h-full w-[420px] bg-white border-l shadow-xl z-40 flex flex-col">
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

          {/* Panel body */}
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
                const isReply = msg.labelIds.includes("SENT")
                  ? false
                  : !msg.from.includes(
                      process.env.NEXT_PUBLIC_GMAIL_SENDER ?? "ravi.soni4254"
                    );
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
                    <p className="text-xs text-gray-500 truncate">
                      <span className="font-medium">From:</span> {msg.from}
                    </p>
                    <p className="text-gray-700 text-xs leading-relaxed line-clamp-3">
                      {msg.snippet}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Panel footer — admin only actions */}
          {isAdmin && (
            <div className="border-t px-5 py-4 space-y-2">
              {threadError && (
                <p className="text-xs text-red-500">{threadError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 flex-1 h-8 text-xs"
                  onClick={() => openThreadPanel(panelItem)}
                  disabled={threadLoading}
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 flex-1 h-8 text-xs"
                  onClick={handleSendFollowup}
                  disabled={sendingFollowup}
                >
                  {sendingFollowup ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Send Follow-up
                </Button>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
