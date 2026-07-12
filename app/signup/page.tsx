"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const USERNAME_RE = /^[a-z0-9-]{3,30}$/;

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!USERNAME_RE.test(username)) {
      setError(
        "Username must be 3-30 characters: lowercase letters, numbers, and dashes only."
      );
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="main-content">
      <div className="auth-box">
        <h2>Sign Up</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-item">
            <label htmlFor="username">Username</label>
            <div className="form-hint">
              3-30 chars, lowercase letters, numbers, and dashes
            </div>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
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
              {submitting ? "signing up..." : "Sign Up"}
            </button>
          </div>
        </form>
        <div className="auth-switch">
          already have an account? <Link href="/login">log in</Link>
        </div>
      </div>
    </div>
  );
}
