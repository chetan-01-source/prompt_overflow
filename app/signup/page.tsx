"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const USERNAME_RE = /^[a-z0-9-]{3,30}$/;

type Mode = "password" | "magic";

export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSuccess(null);
  }

  // Returns true when the username is free. Profiles are publicly readable,
  // so the anon client can check this before we commit to creating an account.
  async function usernameIsAvailable(
    supabase: ReturnType<typeof createClient>,
    uname: string
  ): Promise<boolean> {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", uname)
      .maybeSingle();
    return !data;
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
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
    if (!(await usernameIsAvailable(supabase, username))) {
      setError("That username is already taken.");
      setSubmitting(false);
      return;
    }
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

  async function handleMagicSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!USERNAME_RE.test(username)) {
      setError(
        "Username must be 3-30 characters: lowercase letters, numbers, and dashes only."
      );
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    if (!(await usernameIsAvailable(supabase, username))) {
      setError("That username is already taken.");
      setSubmitting(false);
      return;
    }
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
        data: { username },
      },
    });
    if (otpError) {
      setError(otpError.message);
      setSubmitting(false);
      return;
    }
    setSuccess("Check your email for a link to finish creating your account.");
    setSubmitting(false);
  }

  return (
    <div className="main-content">
      <div className="auth-box">
        <h2>Sign Up</h2>

        <div className="auth-tabs">
          <button
            className={`auth-tab${mode === "password" ? " active" : ""}`}
            onClick={() => switchMode("password")}
            type="button"
          >
            Password
          </button>
          <button
            className={`auth-tab${mode === "magic" ? " active" : ""}`}
            onClick={() => switchMode("magic")}
            type="button"
          >
            Magic Link
          </button>
        </div>

        {mode === "password" && (
          <form onSubmit={handlePasswordSubmit}>
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
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? "signing up..." : "Sign Up"}
              </button>
            </div>
          </form>
        )}

        {mode === "magic" && (
          <form onSubmit={handleMagicSubmit}>
            <p className="auth-hint">
              Pick a username and enter your email. We&apos;ll send a link to
              finish creating your account, no password needed.
            </p>
            <div className="form-item">
              <label htmlFor="magic-username">Username</label>
              <div className="form-hint">
                3-30 chars, lowercase letters, numbers, and dashes
              </div>
              <input
                id="magic-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-item">
              <label htmlFor="magic-email">Email</label>
              <input
                id="magic-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
          already have an account? <Link href="/login">log in</Link>
        </div>
      </div>
    </div>
  );
}
