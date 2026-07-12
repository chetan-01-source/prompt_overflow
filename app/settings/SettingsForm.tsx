"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { updateProfile } from "./actions";

const USERNAME_RE = /^[a-z0-9-]{3,30}$/;

export default function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();

  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url ?? "");
  const [aboutMe, setAboutMe] = useState(profile.about_me ?? "");

  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    setServerError(null);
    setSuccess(false);

    const trimmed = username.trim().toLowerCase();
    if (!USERNAME_RE.test(trimmed)) {
      setClientError(
        "Username must be 3-30 characters: lowercase letters, numbers, and dashes only."
      );
      return;
    }

    setSubmitting(true);
    const result = await updateProfile({
      username: trimmed,
      display_name: displayName,
      location,
      website_url: websiteUrl,
      about_me: aboutMe,
    });
    setSubmitting(false);

    if (result.error) {
      setServerError(result.error);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-item">
        <label htmlFor="username">Username</label>
        <div className="form-hint">
          3-30 chars, lowercase letters, numbers, and dashes only
        </div>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <div className="settings-note">
          Changing your username takes effect immediately. Your login email stays the same.
        </div>
      </div>

      <div className="form-item">
        <label htmlFor="display_name">Display Name</label>
        <div className="form-hint">Optional. Shown instead of username in some places.</div>
        <input
          id="display_name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div className="form-item">
        <label htmlFor="location">Location</label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="form-item">
        <label htmlFor="website_url">Website</label>
        <input
          id="website_url"
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div className="form-item">
        <label htmlFor="about_me">About Me</label>
        <textarea
          id="about_me"
          value={aboutMe}
          onChange={(e) => setAboutMe(e.target.value)}
          rows={5}
        />
      </div>

      {(clientError || serverError) && (
        <div className="form-error">{clientError ?? serverError}</div>
      )}

      {success && (
        <div className="settings-success">Profile saved successfully.</div>
      )}

      <div className="form-item">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
