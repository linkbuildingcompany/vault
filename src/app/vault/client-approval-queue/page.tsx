"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import {
  Plus, Check, X, Clock, Globe, Loader2, ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VaultItem {
  id: number;
  website_url: string;
  accepted: string; // "pending" | "Y" | "N"
  gmail_thread_id: string | null;
  partner_email: string | null;
  introduced_at: string | null;
  added_to_system: boolean | null;
  created_at: string;
  date_added: string | null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingDomain, setAddingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "Y" | "N">("all");
  const [notification, setNotification] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!authLoading && !role) router.push("/login");
  }, [authLoading, role, router]);

  async function fetchItems() {
    setLoading(true);
    const res = await fetch("/api/vault/items");
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { fetchItems(); }, []);

  function notify(msg: string, ok = true) {
    setNotification({ msg, ok });
    setTimeout(() => setNotification(null), 3500);
  }

  async function handleAddDomain() {
    const trimmed = newDomain.trim();
    if (!trimmed) return;
    setSubmitting(true);
    const res = await fetch("/api/vault/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website_url: trimmed }),
    });
    if (res.ok) {
      setNewDomain("");
      setAddingDomain(false);
      await fetchItems();
      notify("Domain added & FatJoe team notified ✓");
    } else {
      const err = await res.json().catch(() => ({}));
      notify(err.error ?? "Failed to add domain", false);
    }
    setSubmitting(false);
  }

  async function updateItem(
    id: number,
    updates: { accepted?: string; added_to_system?: boolean }
  ) {
    setUpdatingId(id);
    const res = await fetch(`/api/vault/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
      );
    } else {
      notify("Update failed", false);
    }
    setUpdatingId(null);
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const filtered = items.filter((i) =>
    filter === "all" ? true : i.accepted === filter
  );

  const stats = {
    total: items.length,
    pending: items.filter((i) => i.accepted === "pending").length,
    approved: items.filter((i) => i.accepted === "Y").length,
    rejected: items.filter((i) => i.accepted === "N").length,
    introduced: items.filter((i) => !!i.introduced_at).length,
    inSystem: items.filter((i) => i.added_to_system).length,
  };

  if (authLoading) return null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">

      {/* Toast */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            notification.ok
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Domain Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            Add domains, manage FatJoe approvals, track introductions and system status.
          </p>
        </div>
        {!addingDomain && (
          <button
            onClick={() => setAddingDomain(true)}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Domain
          </button>
        )}
      </div>

      {/* Add Domain inline form */}
      {addingDomain && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
          <Globe className="h-4 w-4 text-indigo-500 shrink-0" />
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
            placeholder="e.g. example.com"
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400"
            autoFocus
          />
          <button
            onClick={handleAddDomain}
            disabled={submitting || !newDomain.trim()}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Add & Notify FatJoe
          </button>
          <button
            onClick={() => { setAddingDomain(false); setNewDomain(""); }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-gray-900" },
          { label: "Pending", value: stats.pending, color: "text-yellow-600" },
          { label: "Approved", value: stats.approved, color: "text-green-600" },
          { label: "Rejected", value: stats.rejected, color: "text-red-500" },
          { label: "Introduced", value: stats.introduced, color: "text-blue-600" },
          { label: "In FJ System", value: stats.inSystem, color: "text-purple-600" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-gray-200 rounded-xl p-3 text-center"
          >
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "pending", "Y", "N"] as const).map((f) => {
          const labels = { all: "All", pending: "Pending", Y: "Approved", N: "Rejected" };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Domain
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Added
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                FatJoe Approval
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Introduced
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                In FJ System
              </th>
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading domains…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-400">
                  {filter === "all"
                    ? "No domains yet — click Add Domain to get started."
                    : "No domains match this filter."}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={item.id}
                  className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                >
                  {/* Domain */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <a
                        href={`https://${item.website_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gray-900 hover:text-indigo-600 transition-colors"
                      >
                        {item.website_url}
                      </a>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {item.date_added ??
                      (item.created_at
                        ? new Date(item.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—")}
                  </td>

                  {/* Approval */}
                  <td className="px-4 py-3 text-center">
                    {updatingId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-300" />
                    ) : (
                      <ApprovalSelect
                        value={item.accepted}
                        onChange={(val) => updateItem(item.id, { accepted: val })}
                      />
                    )}
                  </td>

                  {/* Introduced */}
                  <td className="px-4 py-3 text-center">
                    {item.introduced_at ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                        <Check className="h-3 w-3" />
                        {new Date(item.introduced_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        Not yet
                      </span>
                    )}
                  </td>

                  {/* In FJ System */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() =>
                        updateItem(item.id, { added_to_system: !item.added_to_system })
                      }
                      disabled={updatingId === item.id}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                        item.added_to_system
                          ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                          : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {item.added_to_system ? (
                        <>
                          <Check className="h-3 w-3" />
                          Added
                        </>
                      ) : (
                        <>
                          <X className="h-3 w-3" />
                          Not Added
                        </>
                      )}
                    </button>
                  </td>

                  {/* Arrow to Introductions */}
                  <td className="px-4 py-3">
                    {item.gmail_thread_id && (
                      <button
                        onClick={() => router.push("/vault/introductions")}
                        className="text-gray-300 hover:text-indigo-500 transition-colors"
                        title="View in Introductions"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        Adding a domain automatically emails the FatJoe team for review.
      </p>
    </div>
  );
}

// ─── Approval Select ──────────────────────────────────────────────────────────

function ApprovalSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Y: "bg-green-50 text-green-700 border-green-200",
    N: "bg-red-50 text-red-600 border-red-200",
  };

  const labels: Record<string, string> = {
    pending: "Pending",
    Y: "Approved",
    N: "Rejected",
  };

  const currentStyle = styles[value] ?? styles.pending;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer appearance-none ${currentStyle}`}
    >
      <option value="pending">Pending</option>
      <option value="Y">Approved</option>
      <option value="N">Rejected</option>
    </select>
  );
}
