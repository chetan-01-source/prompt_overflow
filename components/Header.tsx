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
          <span className="site-logo-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="6" fill="#f48024" />
              <g fill="#ffffff">
                <rect x="13" y="21.4" width="13" height="2.7" rx="1.35" />
                <rect x="13.4" y="17.3" width="12.6" height="2.7" rx="1.35" transform="rotate(-5 13.4 17.3)" />
                <rect x="14.6" y="13.2" width="11.4" height="2.7" rx="1.35" transform="rotate(-10 14.6 13.2)" />
              </g>
              <path d="M6.4 11 L11 15.4 L6.4 19.8" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </span>
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
