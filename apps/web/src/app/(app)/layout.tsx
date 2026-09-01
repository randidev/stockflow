"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const NAV = [
  { href: "/products", label: "Products" },
  { href: "/invoices", label: "Invoices" },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api("/auth/me")
      .then(() => setReady(true))
      .catch(() => router.replace("/login"));
  }, [router]);

  async function handleLogout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ink-2">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-2/30 border-t-ink-2" />
        <span className="ml-2">Loading</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
              <span className="h-2 w-2 rounded-sm bg-accent" />
              StockFlow
            </span>
            <div className="flex gap-4 text-sm">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active ? "font-medium text-ink" : "text-ink-2 transition-colors hover:text-ink"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
          <button onClick={handleLogout} className="text-sm text-ink-2 transition-colors hover:text-ink">
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
