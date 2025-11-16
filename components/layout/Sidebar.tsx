"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden min-h-screen w-64 border-r border-black/10 bg-white/60 p-4 backdrop-blur dark:border-white/10 dark:bg-black/40 md:block">
      <div className="mb-6 px-2">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded bg-black text-white dark:bg-white dark:text-black text-center leading-8 font-bold">
            C
          </span>
          <span className="text-lg font-semibold">CryptoTrendLab</span>
        </Link>
      </div>
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}


