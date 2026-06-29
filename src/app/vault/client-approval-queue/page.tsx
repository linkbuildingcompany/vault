"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { stripDomain, formatMonth, currentMonth } from "@/lib/utils";
import type { VaultItem } from "@/lib/supabase";

type Accepted = "pending" | "Y" | "N";
const nextStatus: Record<Accepted, Accepted> = {
  pending: "Y",
  Y: "N",
  N: "pending",
};

function StatusPill({
  item,
  onToggle,
}: {
  item: VaultItem;
  onToggle: (id: number, next: Accepted) => void;
}) {
  const status = item.accepted as Accepted;
  const variantMap: Record<Accepted, "pending" | "approved" | "rejected"> = {
    pending: "pending",
    Y: "approved",
    N: "rejected",
  };
  const labelMap: Record<Accepted, string> = {
    pending: "Pending",
    Y: "Yes ✓",
    N: "No ✗",
  };
  return (
    <Badge
      variant={variantMap[status]}
      className="select-none text-xs px-3 py-1"
      onClick={() => onToggle(item.id, nextStatus[status])}
    >
      {labelMap[status]}
    </Badge>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-3xl font-bold ${color}`}>{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function ClientApprovalQueuePage() {
  const [allItems, setAllItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchItems = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vault/items?month=${m}`);
      const data = await res.json();
      setAllItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(month); }, [month, fetchItems]);

  const filtered = allItems.filter((item) =>
    item.website_url.toLowerCase().includes(search.toLowerCase())
  );

  const total = allItems.length;
  const approved = allItems.filter((i) => i.accepted === "Y").length;
  const rejected = allItems.filter((i) => i.accepted === "N").length;
  const pending = allItems.filter((i) => i.accepted === "pending").length;

  const monthOptions: string[] = [];
  const now = new Date();
  for (let y = 2024; y <= now.getFullYear(); y++) {
    const maxM = y === now.getFullYear() ? now.getMonth() + 1 : 12;
    for (let m = 1; m <= maxM; m++) {
      monthOptions.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  monthOptions.reverse();

  async function handleToggle(id: number, next: Accepted) {
    setAllItems((prev) => prev.map((i) => (i.id === id ? { ...i, accepted: next } : i)));
    await fetch(`/api/vault/items/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: next }),
    });
  }

  async function handleDelete(id: number) {
    setAllItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/vault/items/${id}`, { method: "DELETE" });
  }

  async function handleAdd() {
    const domain = stripDomain(newDomain);
    if (!domain) return;
    setAdding(true);
    try {
      const res = await fetch("/api/vault/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website_url: domain }),
      });
      if (res.ok) {
        const item = await res.json();
        const itemMonth = formatMonth(item.created_at);
        if (itemMonth === month) setAllItems((prev) => [item, ...prev]);
        setNewDomain("");
        setAddOpen(false);
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleSheetSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/vault/run-sheet-import", { method: "POST" });
      if (res.ok) await fetchItems(month);
    } finally {
      setSyncing(false);
    }
  }

  function handleReset() {
    setSearch("");
    setMonth(currentMonth());
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Domains</h2>
        <div className="w-44">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {new Date(`${m}-15`).toLocaleString("en", { month: "long", year: "numeric" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Domains" value={total} color="text-gray-800" />
        <KpiCard label="Approved" value={approved} color="text-green-600" />
        <KpiCard label="Rejected" value={rejected} color="text-red-600" />
        <KpiCard label="Pending" value={pending} color="text-yellow-600" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search domain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Domain</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 pt-2">
              <Input
                placeholder="example.com or https://www.example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">https:// and www. will be stripped automatically.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAdd} disabled={adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button size="sm" variant="outline" className="gap-2" onClick={handleSheetSync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Pull from Sheet
        </Button>

        <Button size="icon" variant="ghost" onClick={handleReset} title="Reset filters">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Domain</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 w-32">Accepted?</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-gray-400">No domains found.</td></tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-800">{item.website_url}</td>
                  <td className="px-4 py-3 text-center"><StatusPill item={item} onToggle={handleToggle} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-gray-400">
            Showing {filtered.length} of {allItems.length} domains
          </div>
        )}
      </div>
    </main>
  );
}
