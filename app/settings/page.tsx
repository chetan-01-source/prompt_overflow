import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings - Prompt Overflow",
};

export default async function SettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="main-content" style={{ width: "100%", borderRight: "none" }}>
        <div className="page-header">
          <h1>Settings</h1>
        </div>
        <p>
          You must be{" "}
          <Link href="/login">logged in</Link> to access settings.
        </p>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <div className="main-content" style={{ width: "100%", borderRight: "none" }}>
        <div className="page-header">
          <h1>Settings</h1>
        </div>
        <p>Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ width: "100%", borderRight: "none" }}>
      <div className="page-header">
        <h1>Settings</h1>
      </div>
      <SettingsForm profile={profile as Profile} />
    </div>
  );
}
