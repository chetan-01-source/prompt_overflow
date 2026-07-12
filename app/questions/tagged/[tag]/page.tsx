import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QuestionSummary from "@/components/QuestionSummary";
import type { Question, Tag } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

const TABS = ["newest", "active", "votes", "unanswered"] as const;
type Tab = (typeof TABS)[number];

function pageNumbers(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

export default async function TaggedQuestionsPage({
  params,
  searchParams,
}: {
  params: { tag: string };
  searchParams: { tab?: string; page?: string };
}) {
  const tagName = decodeURIComponent(params.tag);
  const tab: Tab = TABS.includes(searchParams.tab as Tab)
    ? (searchParams.tab as Tab)
    : "newest";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = createClient();

  const { data: tag } = await supabase
    .from("tags")
    .select("*")
    .eq("name", tagName)
    .maybeSingle();

  if (!tag) {
    return (
      <>
        <div className="main-content">
          <div className="page-header">
            <h1>Questions tagged [{tagName}]</h1>
            <Link href="/ask" className="btn-primary">
              Ask Question
            </Link>
          </div>
          <div className="notice-empty">Tag not found</div>
        </div>
        <div className="sidebar" />
      </>
    );
  }

  const typedTag = tag as Tag;

  const { data: tagRows } = await supabase
    .from("question_tags")
    .select("question_id")
    .eq("tag_id", typedTag.id);

  const ids = (tagRows ?? []).map(
    (r: { question_id: number }) => r.question_id
  );

  let list: Question[] = [];
  let total = 0;
  let tags: Tag[] = [];

  if (ids.length > 0) {
    let countQuery = supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .in("id", ids);
    let query = supabase
      .from("questions")
      .select("*, profiles(*), question_tags(tags(*))")
      .in("id", ids);

    if (tab === "active") {
      query = query.order("last_activity_at", { ascending: false });
    } else if (tab === "votes") {
      query = query.order("score", { ascending: false });
    } else if (tab === "unanswered") {
      query = query.eq("answer_count", 0).order("created_at", { ascending: false });
      countQuery = countQuery.eq("answer_count", 0);
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const [{ count }, { data: questions }, { data: topTags }] =
      await Promise.all([
        countQuery,
        query.range(offset, offset + PAGE_SIZE - 1),
        supabase
          .from("tags")
          .select("*")
          .order("question_count", { ascending: false })
          .limit(10),
      ]);

    total = count ?? 0;
    list = (questions ?? []) as Question[];
    tags = (topTags ?? []) as Tag[];
  } else {
    const { data: topTags } = await supabase
      .from("tags")
      .select("*")
      .order("question_count", { ascending: false })
      .limit(10);
    tags = (topTags ?? []) as Tag[];
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) =>
    `/questions/tagged/${encodeURIComponent(typedTag.name)}?tab=${tab}&page=${p}`;

  return (
    <>
      <div className="main-content">
        <div className="page-header">
          <h1>Questions tagged [{typedTag.name}]</h1>
          <Link href="/ask" className="btn-primary">
            Ask Question
          </Link>
        </div>
        {typedTag.description && (
          <div className="yellow-box">{typedTag.description}</div>
        )}
        <div className="subheader-row">
          <div className="question-count">
            {total.toLocaleString()} questions
          </div>
          <div className="sort-tabs">
            {TABS.map((t) => (
              <Link
                key={t}
                href={`/questions/tagged/${encodeURIComponent(typedTag.name)}?tab=${t}`}
                className={tab === t ? "selected" : ""}
              >
                {t}
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
        {totalPages > 1 && (
          <div className="pager">
            {page > 1 && <Link href={pageHref(page - 1)}>prev</Link>}
            {pageNumbers(page, totalPages).map((p) =>
              p === page ? (
                <span key={p} className="current">
                  {p}
                </span>
              ) : (
                <Link key={p} href={pageHref(p)}>
                  {p}
                </Link>
              )
            )}
            {page < totalPages && <Link href={pageHref(page + 1)}>next</Link>}
          </div>
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
            {tags.map((t) => (
              <Link
                key={t.id}
                href={`/questions/tagged/${t.name}`}
                className="post-tag"
              >
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
