"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  History,
  Check,
  X,
  AlertCircle,
  Loader2,
  Globe,
  Edit2,
  Clock,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface WebsiteReview {
  id: string;
  domain: string;
  review_status: "Pending Review" | "Approved" | "Rejected" | "Needs Changes";
  system_status: "Not Added to System" | "Added to System";
  date_added: string;
  review_comments: string;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  website_id: string;
  domain: string;
  user_email: string;
  field_changed: string;
  previous_value: string | null;
  new_value: string;
  changed_at: string;
}

interface Summary {
  total: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  needsChanges: number;
  addedToSystem: number;
  notAddedToSystem: number;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

// ── Constants ────────────────────────────────────────────────────────────────

const REVIEW_STATUSES = [
  "Pending Review",
  "Approved",
  "Rejected",
  "Needs Changes",
];
const SYSTEM_STATUSES = ["Not Added to System", "Added to System"];
const PAGE_SIZE = 25;

const reviewStatusStyle: Record<string, string> = {
  "Pending Review": "bg-yellow-100 text-yellow-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  "Needs Changes": "bg-orange-100 text-orange-800",
};

const systemStatusStyle: Record<string, string> = {
  "Not Added to System": "bg-gray-100 text-gray-600",
  "Added to System": "bg-blue-100 text-blue-800",
};

const EMPTY_SUMMARY: Summary = {
  total: 0,
  pendingReview: 0,
  approved: 0,
  rejected: 0,
  needsChanges: 0,
  addedToSystem: 0,
  notAddedToSystem: 0,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function WebsiteReviewPage() {
  const { user, role, loading: authLoading } = useAuth();

  // Data
  const [items, setItems] = useState<WebsiteReview[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterReviewStatus, setFilterReviewStatus] = useState("");
  const [filterSystemStatus, setFilterSystemStatus] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);

  // Selection / bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkReviewStatus, setBulkReviewStatus] = useState("");
  const [bulkSystemStatus, setBulkSystemStatus] = useState("");
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Inline editing — comments
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  // Inline editing — domain (admin only)
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [editingDomainText, setEditingDomainText] = useState("");

  // Add domain dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Delete single
  const [deleteTarget, setDeleteTarget] = useState<WebsiteReview | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Audit log drawer
  const [auditItem, setAuditItem] = useState<WebsiteReview | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast helper ────────────────────────────────────────────────────────

  const toast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        3500
      );
    },
    []
  );

  // ── Debounce search ─────────────────────────────────────────────────────

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [filterReviewStatus, filterSystemStatus, sort]);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        reviewStatus: filterReviewStatus,
        systemStatus: filterSystemStatus,
        sort,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/vault/reviews?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
      setSummary(json.summary ?? EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterReviewStatus, filterSystemStatus, sort, page]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [fetchData, authLoading]);

  // ── Selection helpers ────────────────────────────────────────────────────

  const allSelected =
    items.length > 0 && items.every((i) => selectedIds.has(i.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        items.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        items.forEach((i) => next.add(i.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Update single item ───────────────────────────────────────────────────

  const updateItem = async (
    id: string,
    updates: Record<string, unknown>,
    currentItem?: WebsiteReview
  ): Promise<boolean> => {
    const item = currentItem ?? items.find((i) => i.id === id);
    const newStatus = updates.review_status as string | undefined;
    const effectiveStatus = newStatus ?? item?.review_status ?? "";
    const effectiveComments =
      updates.review_comments !== undefined
        ? String(updates.review_comments).trim()
        : String(item?.review_comments ?? "").trim();

    if (
      (effectiveStatus === "Rejected" ||
        effectiveStatus === "Needs Changes") &&
      !effectiveComments
    ) {
      toast(
        `Review comments are required for "${effectiveStatus}" status`,
        "error"
      );
      return false;
    }

    const res = await fetch(`/api/vault/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, userEmail: user?.email }),
    });

    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      fetchData(); // refresh summary counts
      return true;
    } else {
      const err = await res.json();
      toast(err.error || "Update failed", "error");
      return false;
    }
  };

  // ── Add domain ───────────────────────────────────────────────────────────

  const handleAddDomain = async () => {
    setAddError("");
    if (!newDomain.trim()) {
      setAddError("Please enter a domain");
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch("/api/vault/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain, userEmail: user?.email }),
      });
      if (res.ok) {
        toast("Domain added successfully");
        setShowAddDialog(false);
        setNewDomain("");
        setPage(1);
        fetchData();
      } else {
        const err = await res.json();
        setAddError(err.error || "Failed to add domain");
      }
    } finally {
      setAddLoading(false);
    }
  };

  // ── Delete single ────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/vault/reviews/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast("Domain deleted");
        setDeleteTarget(null);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteTarget.id);
          return next;
        });
        fetchData();
      } else {
        toast("Delete failed", "error");
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Bulk actions ─────────────────────────────────────────────────────────

  const handleBulkAction = async (action: string, value?: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    const res = await fetch("/api/vault/reviews/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids, value, userEmail: user?.email, role }),
    });

    if (res.ok) {
      const result = await res.json();
      toast(
        `Updated ${result.affected} domain${result.affected !== 1 ? "s" : ""}`
      );
      setSelectedIds(new Set());
      setBulkReviewStatus("");
      setBulkSystemStatus("");
      setBulkDeleteConfirm(false);
      fetchData();
    } else {
      const err = await res.json();
      toast(err.error || "Action failed", "error");
    }
  };

  // ── Audit log ────────────────────────────────────────────────────────────

  const loadAuditLog = async (item: WebsiteReview) => {
    setAuditItem(item);
    setAuditLogs([]);
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/vault/reviews/${item.id}/audit`);
      if (res.ok) setAuditLogs(await res.json());
    } finally {
      setAuditLoading(false);
    }
  };

  // ── Inline comment save ──────────────────────────────────────────────────

  const saveComment = async (id: string) => {
    const item = items.find((i) => i.id === id);
    const ok = await updateItem(id, { review_comments: editingCommentText }, item);
    if (ok) {
      setEditingCommentId(null);
      toast("Comment saved");
    }
  };

  // ── Inline domain save (admin) ───────────────────────────────────────────

  const saveDomain = async (id: string) => {
    const val = editingDomainText.trim().toLowerCase();
    if (!val) return;
    const ok = await updateItem(id, { domain: val });
    if (ok) {
      setEditingDomainId(null);
      toast("Domain updated");
    }
  };

  // ── Formatters ───────────────────────────────────────────────────────────

  const fmtDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const fmtField = (f: string) =>
    f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // ── Render ───────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website Review</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage websites and their review status
          </p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Domain
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {(
          [
            {
              label: "Total",
              value: summary.total,
              cls: "border-gray-200 bg-white",
            },
            {
              label: "Pending Review",
              value: summary.pendingReview,
              cls: "border-yellow-200 bg-yellow-50",
            },
            {
              label: "Approved",
              value: summary.approved,
              cls: "border-green-200 bg-green-50",
            },
            {
              label: "Rejected",
              value: summary.rejected,
              cls: "border-red-200 bg-red-50",
            },
            {
              label: "Needs Changes",
              value: summary.needsChanges,
              cls: "border-orange-200 bg-orange-50",
            },
            {
              label: "Added to System",
              value: summary.addedToSystem,
              cls: "border-blue-200 bg-blue-50",
            },
            {
              label: "Not Added",
              value: summary.notAddedToSystem,
              cls: "border-gray-200 bg-gray-50",
            },
          ] as { label: string; value: number; cls: string }[]
        ).map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border p-3 ${card.cls}`}
          >
            <p className="text-xs text-gray-500 leading-tight">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search domains…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 bg-white"
          />
        </div>
        <select
          value={filterReviewStatus}
          onChange={(e) => setFilterReviewStatus(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        >
          <option value="">All Review Statuses</option>
          {REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterSystemStatus}
          onChange={(e) => setFilterSystemStatus(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        >
          <option value="">All System Statuses</option>
          {SYSTEM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
          className="text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
        {(filterReviewStatus || filterSystemStatus || debouncedSearch) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterReviewStatus("");
              setFilterSystemStatus("");
            }}
            className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        )}
      </div>

      {/* ── Bulk Actions Bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-semibold text-blue-800">
            {selectedIds.size} selected
          </span>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {/* Bulk Review Status */}
            <div className="flex items-center gap-1">
              <select
                value={bulkReviewStatus}
                onChange={(e) => setBulkReviewStatus(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">Set Review Status…</option>
                {REVIEW_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {bulkReviewStatus && (
                <button
                  onClick={() =>
                    handleBulkAction("update_review_status", bulkReviewStatus)
                  }
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply
                </button>
              )}
            </div>

            {/* Bulk System Status */}
            <div className="flex items-center gap-1">
              <select
                value={bulkSystemStatus}
                onChange={(e) => setBulkSystemStatus(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">Set System Status…</option>
                {SYSTEM_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {bulkSystemStatus && (
                <button
                  onClick={() =>
                    handleBulkAction("update_system_status", bulkSystemStatus)
                  }
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply
                </button>
              )}
            </div>

            {/* Bulk Delete (admin only) */}
            {role === "admin" &&
              (bulkDeleteConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-600 font-medium">
                    Delete {selectedIds.size} domains?
                  </span>
                  <button
                    onClick={() => handleBulkAction("delete")}
                    className="text-xs px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setBulkDeleteConfirm(false)}
                    className="text-xs px-2.5 py-1.5 border rounded-lg hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete selected
                </button>
              ))}

            <button
              onClick={() => {
                setSelectedIds(new Set());
                setBulkDeleteConfirm(false);
              }}
              className="text-xs px-2.5 py-1.5 border rounded-lg hover:bg-white text-gray-600"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="w-10 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 min-w-[180px]">
                  Domain
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 min-w-[150px]">
                  Review Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 min-w-[160px]">
                  System Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                  Date Added
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 min-w-[200px]">
                  Review Comments
                </th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-gray-400">
                    <Globe className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                    <p className="font-medium">No domains found</p>
                    <p className="text-xs mt-1">
                      {debouncedSearch || filterReviewStatus || filterSystemStatus
                        ? "Try adjusting your filters"
                        : "Click \"Add Domain\" to get started"}
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50/60 transition-colors ${
                      selectedIds.has(item.id) ? "bg-blue-50/40" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded cursor-pointer"
                      />
                    </td>

                    {/* Domain */}
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {editingDomainId === item.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editingDomainText}
                            onChange={(e) =>
                              setEditingDomainText(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveDomain(item.id);
                              if (e.key === "Escape") setEditingDomainId(null);
                            }}
                            className="border rounded px-2 py-0.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                            autoFocus
                          />
                          <button
                            onClick={() => saveDomain(item.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingDomainId(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className={
                            role === "admin"
                              ? "cursor-pointer hover:underline underline-offset-2"
                              : ""
                          }
                          onDoubleClick={() => {
                            if (role === "admin") {
                              setEditingDomainId(item.id);
                              setEditingDomainText(item.domain);
                            }
                          }}
                          title={
                            role === "admin" ? "Double-click to edit" : undefined
                          }
                        >
                          {item.domain}
                        </span>
                      )}
                    </td>

                    {/* Review Status */}
                    <td className="px-4 py-3">
                      <select
                        value={item.review_status}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          // Check if comments are needed
                          if (
                            (newStatus === "Rejected" ||
                              newStatus === "Needs Changes") &&
                            !item.review_comments?.trim()
                          ) {
                            toast(
                              `Add review comments before setting "${newStatus}"`,
                              "error"
                            );
                            return;
                          }
                          await updateItem(
                            item.id,
                            { review_status: newStatus },
                            item
                          );
                        }}
                        className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-900/20 ${
                          reviewStatusStyle[item.review_status]
                        }`}
                      >
                        {REVIEW_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* System Status */}
                    <td className="px-4 py-3">
                      <select
                        value={item.system_status}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            { system_status: e.target.value },
                            item
                          )
                        }
                        className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-900/20 ${
                          systemStatusStyle[item.system_status]
                        }`}
                      >
                        {SYSTEM_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Date Added */}
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {fmtDate(item.date_added)}
                    </td>

                    {/* Review Comments */}
                    <td className="px-4 py-3 max-w-xs">
                      {editingCommentId === item.id ? (
                        <div className="flex flex-col gap-1.5">
                          <textarea
                            value={editingCommentText}
                            onChange={(e) =>
                              setEditingCommentText(e.target.value)
                            }
                            rows={3}
                            placeholder="Add your comments here…"
                            className="border rounded-lg px-2 py-1.5 text-xs resize-none w-full focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => saveComment(item.id)}
                              className="text-xs px-2.5 py-1 bg-gray-900 text-white rounded-md hover:bg-gray-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingCommentId(null)}
                              className="text-xs px-2.5 py-1 border rounded-md hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="group flex items-start gap-1.5 cursor-pointer"
                          onClick={() => {
                            setEditingCommentId(item.id);
                            setEditingCommentText(item.review_comments || "");
                          }}
                          title="Click to edit"
                        >
                          <span
                            className={`text-xs leading-relaxed line-clamp-2 ${
                              item.review_comments
                                ? "text-gray-600"
                                : "text-gray-300 italic"
                            }`}
                          >
                            {item.review_comments || "Click to add…"}
                          </span>
                          <Edit2 className="h-3 w-3 text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5" />
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        {role === "admin" && (
                          <button
                            onClick={() => loadAuditLog(item)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            title="Audit log"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {role === "admin" && (
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(totalPages > 1 || total > 0) && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-sm text-gray-500">
            <span>
              {total === 0
                ? "No results"
                : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                    page * PAGE_SIZE,
                    total
                  )} of ${total}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1 border rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1 border rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add Domain Dialog ── */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Add New Domain
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Enter the website domain. Protocol and www will be stripped
              automatically.
            </p>
            <input
              type="text"
              placeholder="e.g. example.com or https://www.example.com"
              value={newDomain}
              onChange={(e) => {
                setNewDomain(e.target.value);
                setAddError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
              className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 mb-1"
              autoFocus
            />
            {addError && (
              <p className="text-xs text-red-600 mb-3 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {addError}
              </p>
            )}
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewDomain("");
                  setAddError("");
                }}
                className="px-4 py-2 text-sm border rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDomain}
                disabled={addLoading}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-700 disabled:opacity-60 flex items-center gap-2"
              >
                {addLoading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Add Domain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Delete Domain
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Are you sure you want to delete{" "}
                  <strong>{deleteTarget.domain}</strong>? This action cannot be
                  undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm border rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
              >
                {deleteLoading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Audit Log Drawer ── */}
      {auditItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setAuditItem(null)}
          />
          <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            <div className="flex items-start justify-between p-5 border-b">
              <div>
                <h2 className="font-semibold text-gray-900">Audit Log</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">
                  {auditItem.domain}
                </p>
              </div>
              <button
                onClick={() => setAuditItem(null)}
                className="text-gray-400 hover:text-gray-700 mt-0.5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {auditLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Clock className="h-8 w-8 mx-auto mb-3 text-gray-200" />
                  <p className="text-sm font-medium">No history yet</p>
                  <p className="text-xs mt-1">
                    Changes will appear here
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-2 bottom-0 w-px bg-gray-200" />
                  <div className="space-y-0">
                    {auditLogs.map((log, idx) => (
                      <div key={log.id} className="flex gap-4 pb-5">
                        {/* Dot */}
                        <div className="shrink-0 mt-1.5 z-10">
                          <div className="h-3.5 w-3.5 rounded-full bg-white border-2 border-gray-400" />
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-xs font-semibold text-gray-900">
                              {log.user_email}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {fmtDateTime(log.changed_at)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-1.5">
                            Updated{" "}
                            <span className="font-medium text-gray-800">
                              {fmtField(log.field_changed)}
                            </span>
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {log.previous_value !== null && (
                              <>
                                <span className="text-[11px] px-2 py-0.5 bg-red-50 text-red-700 rounded-md line-through">
                                  {log.previous_value || "empty"}
                                </span>
                                <span className="text-gray-300 text-xs">→</span>
                              </>
                            )}
                            <span className="text-[11px] px-2 py-0.5 bg-green-50 text-green-700 rounded-md">
                              {log.new_value || "empty"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Container ── */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white pointer-events-auto ${
              t.type === "success" ? "bg-gray-900" : "bg-red-600"
            }`}
          >
            {t.type === "success" ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
