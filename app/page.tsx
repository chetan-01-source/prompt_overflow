import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QuestionSummary from "@/components/QuestionSummary";
import type { Question, Tag } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

const TABS = [
  { key: "interesting", label: "interesting" },
  { key: "hot", label: "hot" },
  { key: "week", label: "week" },
  { key: "month", label: "month" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = TABS.some((t) => t.key === searchParams.tab)
    ? (searchParams.tab as string)
    : "interesting";

  const supabase = createClient();

  let query = supabase
    .from("questions")
    .select("*, profiles(*), question_tags(tags(*))");

  if (tab === "hot") {
    query = query.order("score", { ascending: false });
  } else if (tab === "week") {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", since).order("score", { ascending: false });
  } else if (tab === "month") {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", since).order("score", { ascending: false });
  } else {
    query = query.order("last_activity_at", { ascending: false });
  }

  const [{ data: questions }, { data: topTags }] = await Promise.all([
    query.range(0, PAGE_SIZE - 1),
    supabase
      .from("tags")
      .select("*")
      .order("question_count", { ascending: false })
      .limit(10),
  ]);

  const list = (questions ?? []) as Question[];
  const tags = (topTags ?? []) as Tag[];

  return (
    <>
      <div className="main-content">
        <div className="page-header">
          <h1>Top Questions</h1>
          <Link href="/ask" className="btn-primary">
            Ask Question
          </Link>
        </div>
        <div className="subheader-row">
          <div className="sort-tabs">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/?tab=${t.key}`}
                className={tab === t.key ? "selected" : ""}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <div className="notice-empty">
            No questions found. <a href="/ask">Ask the first one!</a>
          </div>
        ) : (
          list.map((q) => <QuestionSummary key={q.id} question={q} />)
        )}
      </div>
      <div className="sidebar">
        <div className="yellow-box">
          <h4>Welcome to Prompt Overflow</h4>
          <p>
            Prompt Overflow is a community site for sharing the prompts behind
            websites, apps, and cool ideas you have made. Post what you built,
            share the exact prompt, and help others prompt better.
          </p>
        </div>
        <div className="sidebar-module">
          <h4>Popular Tags</h4>
          <div className="post-taglist">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/questions/tagged/${tag.name}`}
                className="post-tag"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
