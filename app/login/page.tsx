"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="main-content">
      <div className="auth-box">
        <h2>Log In</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-item">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-item">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-item">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "logging in..." : "Log In"}
            </button>
          </div>
        </form>
        <div className="auth-switch">
          don&apos;t have an account? <Link href="/signup">sign up</Link>
        </div>
      </div>
    </div>
  );
}
