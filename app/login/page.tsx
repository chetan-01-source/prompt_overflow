"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    let email = identifier.trim();

    // If identifier does not contain "@", treat as username
    if (!email.includes("@")) {
      const { data: resolved } = await supabase.rpc("email_for_username", {
        p_username: email,
      });
      if (!resolved) {
        setError("No account found with that username.");
        setSubmitting(false);
        return;
      }
      email = resolved;
    }

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

  async function handleMagicSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });
    if (otpError) {
      setError(otpError.message);
      setSubmitting(false);
      return;
    }
    setSuccess("Check your email for a login link.");
    setSubmitting(false);
  }

  return (
    <div className="main-content">
      <div className="auth-box">
        <h2>Log In</h2>

        <div className="auth-tabs">
          <button
            className={`auth-tab${mode === "password" ? " active" : ""}`}
            onClick={() => {
              setMode("password");
              setError(null);
              setSuccess(null);
            }}
            type="button"
          >
            Password
          </button>
          <button
            className={`auth-tab${mode === "magic" ? " active" : ""}`}
            onClick={() => {
              setMode("magic");
              setError(null);
              setSuccess(null);
            }}
            type="button"
          >
            Magic Link
          </button>
        </div>

        {mode === "password" && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-item">
              <label htmlFor="email">Email or username</label>
              <input
                id="email"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
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
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? "logging in..." : "Log In"}
              </button>
            </div>
          </form>
        )}

        {mode === "magic" && (
          <form onSubmit={handleMagicSubmit}>
            <p className="auth-hint">
              Magic link login is email-only. Enter the email associated with
              your account.
            </p>
            <div className="form-item">
              <label htmlFor="magic-email">Email</label>
              <input
                id="magic-email"
                type="email"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                required
              />
            </div>
            {error && <div className="form-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
            <div className="form-item">
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? "sending..." : "Send magic link"}
              </button>
            </div>
          </form>
        )}

        <div className="auth-switch">
          don&apos;t have an account? <Link href="/signup">sign up</Link>
        </div>
      </div>
    </div>
  );
}
