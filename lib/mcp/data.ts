import { createAdminClient } from "@/lib/supabase/admin";

// Read-only data access for the Prompt Overflow MCP server.

export interface PromptSummary {
  id: number;
  title: string;
  prompt: string | null;
  artifact_url: string | null;
  score: number;
  tags: string[];
  author: string | null;
  created_at: string;
  url: string;
}

export interface AnswerDetail {
  id: number;
  body: string;
  prompt: string | null;
  score: number;
  is_accepted: boolean;
  author: string | null;
  created_at: string;
}

export interface QuestionDetail extends PromptSummary {
  body: string;
  view_count: number;
  answer_count: number;
  accepted_answer_id: number | null;
  answers: AnswerDetail[];
}

export interface TagSummary {
  id: number;
  name: string;
  description: string | null;
  question_count: number;
}

const QUESTION_SELECT =
  "id, title, body, prompt, artifact_url, score, view_count, answer_count, accepted_answer_id, created_at, profiles(username, reputation), question_tags(tags(name))";

/* eslint-disable @typescript-eslint/no-explicit-any */

function extractAuthor(profiles: any): string | null {
  if (!profiles) return null;
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return p?.username ?? null;
}

function extractTags(questionTags: any): string[] {
  if (!Array.isArray(questionTags)) return [];
  return questionTags
    .map((qt: any) => {
      const t = Array.isArray(qt?.tags) ? qt.tags[0] : qt?.tags;
      return t?.name ?? null;
    })
    .filter((name: string | null): name is string => typeof name === "string");
}

function mapQuestionSummary(row: any): PromptSummary {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt ?? null,
    artifact_url: row.artifact_url ?? null,
    score: row.score ?? 0,
    tags: extractTags(row.question_tags),
    author: extractAuthor(row.profiles),
    created_at: row.created_at,
    url: `/questions/${row.id}`,
  };
}

export async function listPrompts(opts?: {
  limit?: number;
  offset?: number;
  sort?: "newest" | "votes";
}): Promise<PromptSummary[]> {
  const limit = clamp(opts?.limit ?? 20, 1, 100);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const sort = opts?.sort === "votes" ? "votes" : "newest";

  const supabase = createAdminClient();
  let query = supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .not("prompt", "is", null);

  query =
    sort === "votes"
      ? query.order("score", { ascending: false })
      : query.order("created_at", { ascending: false });

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(`listPrompts failed: ${error.message}`);
  return (data ?? []).map(mapQuestionSummary);
}

export async function searchPrompts(
  query: string,
  limit?: number
): Promise<PromptSummary[]> {
  const max = clamp(limit ?? 20, 1, 100);
  const supabase = createAdminClient();

  // Prefer full-text search; fall back to ilike on title if it errors
  // (e.g. search_tsv column missing) or returns nothing.
  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .textSearch("search_tsv", query, { type: "websearch" })
    .order("score", { ascending: false })
    .limit(max);

  if (!error && data && data.length > 0) {
    return data.map(mapQuestionSummary);
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .ilike("title", `%${query}%`)
    .order("score", { ascending: false })
    .limit(max);

  if (fallbackError) {
    throw new Error(`searchPrompts failed: ${fallbackError.message}`);
  }
  return (fallback ?? []).map(mapQuestionSummary);
}

export async function getQuestion(id: number): Promise<QuestionDetail | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getQuestion failed: ${error.message}`);
  if (!data) return null;

  const { data: answers, error: answersError } = await supabase
    .from("answers")
    .select("id, body, prompt, score, is_accepted, created_at, profiles(username)")
    .eq("question_id", id)
    .order("is_accepted", { ascending: false })
    .order("score", { ascending: false });

  if (answersError) {
    throw new Error(`getQuestion answers failed: ${answersError.message}`);
  }

  const row: any = data;
  return {
    ...mapQuestionSummary(row),
    body: row.body,
    view_count: row.view_count ?? 0,
    answer_count: row.answer_count ?? 0,
    accepted_answer_id: row.accepted_answer_id ?? null,
    answers: (answers ?? []).map((a: any): AnswerDetail => ({
      id: a.id,
      body: a.body,
      prompt: a.prompt ?? null,
      score: a.score ?? 0,
      is_accepted: a.is_accepted ?? false,
      author: extractAuthor(a.profiles),
      created_at: a.created_at,
    })),
  };
}

export async function getPromptsByTag(
  tagName: string,
  limit?: number
): Promise<PromptSummary[]> {
  const max = clamp(limit ?? 20, 1, 100);
  const supabase = createAdminClient();

  // Resolve tag -> question ids via the join table, then fetch questions.
  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .select("id, name")
    .ilike("name", tagName)
    .maybeSingle();

  if (tagError) throw new Error(`getPromptsByTag failed: ${tagError.message}`);
  if (!tag) return [];

  const { data: links, error: linkError } = await supabase
    .from("question_tags")
    .select("question_id")
    .eq("tag_id", tag.id);

  if (linkError) throw new Error(`getPromptsByTag failed: ${linkError.message}`);
  const ids = (links ?? []).map((l: any) => l.question_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .in("id", ids)
    .not("prompt", "is", null)
    .order("score", { ascending: false })
    .limit(max);

  if (error) throw new Error(`getPromptsByTag failed: ${error.message}`);
  return (data ?? []).map(mapQuestionSummary);
}

export async function listTags(limit?: number): Promise<TagSummary[]> {
  const max = clamp(limit ?? 50, 1, 200);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tags")
    .select("id, name, description, question_count")
    .order("question_count", { ascending: false })
    .limit(max);

  if (error) throw new Error(`listTags failed: ${error.message}`);
  return (data ?? []).map((t: any): TagSummary => ({
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    question_count: t.question_count ?? 0,
  }));
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.floor(n), min), max);
}
