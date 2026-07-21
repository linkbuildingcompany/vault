// src/components/vault-nav.tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Globe, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/hooks/useAuth";

interface VaultNavProps {
  role: Role;
  userEmail: string | undefined;
}

export function VaultNav({ role, userEmail }: VaultNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const navLinks = [
    { href: "/vault/website-review", label: "Website Review" },
    { href: "/vault/communications", label: "Communications" },
    ...(role === "admin"
      ? [
          { href: "/vault/alina", label: "Alina Inbox" },
          { href: "/vault/settings", label: "Settings" },
        ]
      : []),
  ];

  return (
    <header className="border-b bg-white px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Vault</h1>
          </div>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{userEmail}</span>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-gray-700 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
