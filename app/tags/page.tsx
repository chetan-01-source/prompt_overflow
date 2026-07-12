import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Tag } from "@/lib/types";

export const dynamic = "force-dynamic";

const PER_PAGE = 36;

function Pager({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  return (
    <div className="pager">
      {page > 1 && <Link href={`/tags?page=${page - 1}`}>prev</Link>}
      {pages.map((p) =>
        p === page ? (
          <span key={p} className="current">
            {p}
          </span>
        ) : (
          <Link key={p} href={`/tags?page=${p}`}>
            {p}
          </Link>
        )
      )}
      {page < totalPages && <Link href={`/tags?page=${page + 1}`}>next</Link>}
    </div>
  );
}

export default async function TagsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  const supabase = createClient();
  const { data, count } = await supabase
    .from("tags")
    .select("*", { count: "exact" })
    .order("question_count", { ascending: false })
    .range(from, to);

  const tags = (data ?? []) as Tag[];
  const totalPages = Math.ceil((count ?? 0) / PER_PAGE);

  return (
    <div className="main-content" style={{ width: "100%", borderRight: "none" }}>
      <div className="page-header">
        <h1>Tags</h1>
      </div>
      <p style={{ fontSize: "13px", color: "#555", marginBottom: "12px" }}>
        A tag is a keyword or label that categorizes your question with other,
        similar questions.
      </p>
      {tags.length === 0 ? (
        <div className="notice-empty">No tags found.</div>
      ) : (
        <div className="tags-grid">
          {tags.map((tag) => (
            <div key={tag.id} className="tag-cell">
              <Link href={`/questions/tagged/${tag.name}`} className="post-tag">
                {tag.name}
              </Link>
              <div className="tag-excerpt">
                {tag.description || "No description yet."}
              </div>
              <div className="tag-count">
                {tag.question_count} prompt{tag.question_count === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pager page={page} totalPages={totalPages} />
    </div>
  );
}
