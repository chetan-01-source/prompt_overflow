import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SearchBox from "@/components/SearchBox";
import NavLinks from "@/components/NavLinks";
import LogoutButton from "@/components/LogoutButton";

export default async function Header() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { username: string; reputation: number } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, reputation")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-wrapper">
          <div className="topbar-links">
            {profile ? (
              <>
                <Link href={`/users/${profile.username}`} className="profile-link">
                  {profile.username}
                </Link>
                <span className="rep-score" title="reputation">
                  {profile.reputation}
                </span>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login">log in</Link>
                <Link href="/signup">sign up</Link>
              </>
            )}
          </div>
          <div className="topbar-links">
            <Link href="/about">about</Link>
            <Link href="/mcp-info">mcp</Link>
          </div>
        </div>
      </div>
      <div className="header">
        <Link href="/" className="site-logo">
          prompt<b>overflow</b>
        </Link>
        <nav className="header-nav">
          <NavLinks />
        </nav>
        <div className="header-search">
          <SearchBox />
        </div>
      </div>
    </>
  );
}
