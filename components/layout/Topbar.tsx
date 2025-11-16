"use client";
import Link from "next/link";
import { useState } from "react";
import { useHealthStatus } from "@/lib/hooks/useHealthStatus";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function Topbar() {
  const [query, setQuery] = useState("");
  const health = useHealthStatus();
  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/dashboard" className="text-sm font-semibold">
            CryptoTrendLab
          </Link>
        </div>
        <div className="flex flex-1 items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coins, pairs, or news..."
            className="w-full max-w-xl rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none ring-0 placeholder:text-black/40 focus:border-black/30 dark:border-white/10 dark:placeholder:text-white/40 dark:focus:border-white/30"
          />
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge state={health.status} />
          <Link
            href="/settings"
            className="rounded-md border border-black/10 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          >
            Settings
          </Link>
        </div>
      </div>
    </header>
  );
}


