import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QuestionSummary from "@/components/QuestionSummary";
import type { Question } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

const TABS = ["relevance", "newest", "votes"] as const;
type Tab = (typeof TABS)[number];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; tab?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const tab: Tab = TABS.includes(searchParams.tab as Tab)
    ? (searchParams.tab as Tab)
    : "relevance";

  const supabase = createClient();

  let list: Question[] = [];

  if (q) {
    let query = supabase
      .from("questions")
      .select("*, profiles(*), question_tags(tags(*))")
      .textSearch("search_tsv", q, { type: "websearch" });

    if (tab === "newest") {
      query = query.order("created_at", { ascending: false });
    } else if (tab === "votes") {
      query = query.order("score", { ascending: false });
    }

    const { data } = await query.range(0, PAGE_SIZE - 1);
    list = (data ?? []) as Question[];

    if (list.length === 0) {
      let fallback = supabase
        .from("questions")
        .select("*, profiles(*), question_tags(tags(*))")
        .ilike("title", `%${q}%`);

      if (tab === "newest") {
        fallback = fallback.order("created_at", { ascending: false });
      } else if (tab === "votes") {
        fallback = fallback.order("score", { ascending: false });
      }

      const { data: fallbackData } = await fallback.range(0, PAGE_SIZE - 1);
      list = (fallbackData ?? []) as Question[];
    }
  }

  const tabHref = (t: Tab) => `/search?q=${encodeURIComponent(q)}&tab=${t}`;

  return (
    <>
      <div className="main-content">
        <div className="page-header">
          <h1>Search Results</h1>
          <Link href="/ask" className="btn-primary">
            Ask Question
          </Link>
        </div>
        <div className="subheader-row">
          <div className="question-count">
            {list.length.toLocaleString()} results
            {q ? ` for "${q}"` : ""}
          </div>
          <div className="sort-tabs">
            {TABS.map((t) => (
              <Link
                key={t}
                href={tabHref(t)}
                className={tab === t ? "selected" : ""}
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <div className="notice-empty">
            Your search returned no matches. Try different keywords.
          </div>
        ) : (
          list.map((question) => (
            <QuestionSummary key={question.id} question={question} />
          ))
        )}
      </div>
      <div className="sidebar">
        <div className="yellow-box">
          <h4>Search tips</h4>
          <p>
            Use plain keywords for full-text search. Quote phrases to match
            them exactly, and keep queries short for the best results.
          </p>
        </div>
      </div>
    </>
  );
}
