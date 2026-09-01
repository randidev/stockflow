"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      router.push("/products");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-canvas p-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-5 p-7">
        <div className="space-y-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="h-2 w-2 rounded-sm bg-accent" />
            StockFlow
          </span>
          <h1 className="text-lg font-semibold text-ink">Sign in</h1>
        </div>

        {error && <p className="banner-danger">{error}</p>}

        <div>
          <label className="label">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </div>

        <div>
          <label className="label">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-center text-sm text-ink-2">
          No account? <Link href="/register" className="link">Register</Link>
        </p>
      </form>
    </div>
  );
}
