import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { avatarColor } from "@/components/UserSignature";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const PER_PAGE = 28;

function Pager({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  return (
    <div className="pager">
      {page > 1 && <Link href={`/users?page=${page - 1}`}>prev</Link>}
      {pages.map((p) =>
        p === page ? (
          <span key={p} className="current">
            {p}
          </span>
        ) : (
          <Link key={p} href={`/users?page=${p}`}>
            {p}
          </Link>
        )
      )}
      {page < totalPages && <Link href={`/users?page=${page + 1}`}>next</Link>}
    </div>
  );
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  const supabase = createClient();
  const { data, count } = await supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("reputation", { ascending: false })
    .range(from, to);

  const users = (data ?? []) as Profile[];
  const totalPages = Math.ceil((count ?? 0) / PER_PAGE);

  return (
    <div className="main-content" style={{ width: "100%", borderRight: "none" }}>
      <div className="page-header">
        <h1>Users</h1>
      </div>
      {users.length === 0 ? (
        <div className="notice-empty">No users found.</div>
      ) : (
        <div className="users-grid">
          {users.map((user) => (
            <div key={user.id} className="user-cell">
              <div
                className="user-gravatar"
                style={{ background: avatarColor(user.username) }}
              >
                {user.username.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <Link href={`/users/${user.username}`}>{user.username}</Link>
                <div>
                  <span className="reputation-score">{user.reputation}</span>
                </div>
                {user.location && (
                  <div className="user-location">{user.location}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pager page={page} totalPages={totalPages} />
    </div>
  );
}
