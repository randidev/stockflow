"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

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
    return <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">Loading...</div>;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex gap-4 text-sm font-medium">
            <span className="font-semibold">StockFlow</span>
            <Link href="/products" className={pathname.startsWith("/products") ? "text-zinc-900" : "text-zinc-500"}>
              Products
            </Link>
            <Link href="/invoices" className={pathname.startsWith("/invoices") ? "text-zinc-900" : "text-zinc-500"}>
              Invoices
            </Link>
          </nav>
          <button onClick={handleLogout} className="text-sm text-zinc-500 hover:text-zinc-900">
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
