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

// A prompt plus the community's proven refinement (accepted/top answer excerpt).
// The technique is where the real creative signal lives.
export interface PromptWithTechnique extends PromptSummary {
  technique: string | null;
  matched_in?: "prompt" | "answer" | "both";
}

// One reusable ingredient for composing a new prompt from proven material.
export interface PromptIngredient {
  id: number;
  title: string;
  prompt: string | null;
  technique: string | null;
  tags: string[];
  score: number;
  url: string;
}

export interface Composition {
  goal: string;
  ingredients: PromptIngredient[];
  guidance: string;
}

// An MCP prompt template surfaced to clients as an invokable slash command.
export interface PromptTemplate {
  name: string;
  title: string;
  description: string;
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

// Condense a markdown answer body into a plain-text technique excerpt.
function excerpt(text: string | null | undefined, max = 600): string | null {
  if (!text) return null;
  const clean = text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "").trim())
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/\r?\n{2,}/g, "\n")
    .trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

// Fetch the "proven refinement" for each question: the accepted answer if any,
// otherwise the top-scoring answer. Returns a map of question_id -> excerpt.
async function fetchTechniques(
  supabase: ReturnType<typeof createAdminClient>,
  questionIds: number[]
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (questionIds.length === 0) return result;

  const { data, error } = await supabase
    .from("answers")
    .select("question_id, body, score, is_accepted")
    .in("question_id", questionIds)
    .order("is_accepted", { ascending: false })
    .order("score", { ascending: false });

  if (error || !data) return result;
  // First row per question wins (accepted, then highest score).
  for (const a of data as any[]) {
    if (!result.has(a.question_id)) {
      const ex = excerpt(a.body);
      if (ex) result.set(a.question_id, ex);
    }
  }
  return result;
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
): Promise<PromptWithTechnique[]> {
  const max = clamp(limit ?? 20, 1, 100);
  const supabase = createAdminClient();

  // 1) Full-text search over question title/body/prompt (search_tsv).
  const questionMatches = new Map<number, PromptSummary>();
  const matchedIn = new Map<number, "prompt" | "answer" | "both">();

  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .textSearch("search_tsv", query, { type: "websearch" })
    .order("score", { ascending: false })
    .limit(max);

  if (!error && data) {
    for (const row of data) {
      questionMatches.set(row.id, mapQuestionSummary(row));
      matchedIn.set(row.id, "prompt");
    }
  }

  // 2) Also search answer bodies. The real creative technique often lives in
  // the accepted/top answer, so a keyword like "screen shake" or "WebAudio"
  // should surface the question even when the prompt itself never says it.
  const { data: answerHits } = await supabase
    .from("answers")
    .select("question_id")
    .textSearch("body", query, { type: "websearch" })
    .limit(max * 3);

  const answerQuestionIds = Array.from(
    new Set((answerHits ?? []).map((a: any) => a.question_id as number))
  ).filter((id) => !questionMatches.has(id));

  if (answerQuestionIds.length > 0) {
    const { data: extraQuestions } = await supabase
      .from("questions")
      .select(QUESTION_SELECT)
      .in("id", answerQuestionIds);
    for (const row of extraQuestions ?? []) {
      questionMatches.set(row.id, mapQuestionSummary(row));
      matchedIn.set(row.id, "answer");
    }
  }
  // Mark questions that matched in both places.
  for (const id of answerQuestionIds) {
    if (matchedIn.get(id) === "prompt") matchedIn.set(id, "both");
  }

  let summaries = Array.from(questionMatches.values());

  // 3) ilike fallback when full-text found nothing at all.
  if (summaries.length === 0) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("questions")
      .select(QUESTION_SELECT)
      .ilike("title", `%${query}%`)
      .order("score", { ascending: false })
      .limit(max);
    if (fallbackError) {
      throw new Error(`searchPrompts failed: ${fallbackError.message}`);
    }
    summaries = (fallback ?? []).map(mapQuestionSummary);
    for (const s of summaries) matchedIn.set(s.id, "prompt");
  }

  // Rank by score, cap, then attach the proven technique excerpt.
  summaries.sort((a, b) => b.score - a.score);
  summaries = summaries.slice(0, max);

  const techniques = await fetchTechniques(
    supabase,
    summaries.map((s) => s.id)
  );

  return summaries.map((s) => ({
    ...s,
    technique: techniques.get(s.id) ?? null,
    matched_in: matchedIn.get(s.id) ?? "prompt",
  }));
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

// Keyword sets used to bias the compose ingredient search toward the goal.
function keywords(text: string): string[] {
  const stop = new Set([
    "the", "a", "an", "and", "or", "but", "for", "with", "that", "this",
    "make", "build", "create", "want", "need", "using", "into", "from",
    "prompt", "app", "page", "website", "site", "generate", "help",
  ]);
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stop.has(w))
    )
  );
}

// ============ DISCOVER (serendipity) ============
// Randomized sample of prompts to spark lateral ideas. Optionally themed by a
// tag and/or excluding tags the caller has already explored.
export async function discoverPrompts(opts?: {
  theme?: string;
  excludeTags?: string[];
  limit?: number;
}): Promise<PromptWithTechnique[]> {
  const max = clamp(opts?.limit ?? 5, 1, 25);
  const supabase = createAdminClient();

  // Resolve a set of question ids to exclude (already-explored tags).
  const excluded = new Set<number>();
  if (opts?.excludeTags && opts.excludeTags.length > 0) {
    const { data: exTags } = await supabase
      .from("tags")
      .select("id")
      .in("name", opts.excludeTags.map((t) => t.toLowerCase()));
    const exIds = (exTags ?? []).map((t: any) => t.id);
    if (exIds.length > 0) {
      const { data: exLinks } = await supabase
        .from("question_tags")
        .select("question_id")
        .in("tag_id", exIds);
      for (const l of exLinks ?? []) excluded.add((l as any).question_id);
    }
  }

  // Optionally narrow to a theme tag.
  let candidateIds: number[] | null = null;
  if (opts?.theme) {
    const { data: tag } = await supabase
      .from("tags")
      .select("id")
      .ilike("name", opts.theme)
      .maybeSingle();
    if (tag) {
      const { data: links } = await supabase
        .from("question_tags")
        .select("question_id")
        .eq("tag_id", (tag as any).id);
      candidateIds = (links ?? []).map((l: any) => l.question_id);
      if (candidateIds.length === 0) return [];
    }
  }

  let query = supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .not("prompt", "is", null);
  if (candidateIds) query = query.in("id", candidateIds);

  // Pull a generous pool then shuffle in-process for real randomness.
  const { data, error } = await query.limit(80);
  if (error) throw new Error(`discoverPrompts failed: ${error.message}`);

  let pool = (data ?? [])
    .map(mapQuestionSummary)
    .filter((p) => !excluded.has(p.id));

  // Fisher-Yates shuffle, take `max`.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, max);

  const techniques = await fetchTechniques(
    supabase,
    chosen.map((c) => c.id)
  );
  return chosen.map((c) => ({
    ...c,
    technique: techniques.get(c.id) ?? null,
  }));
}

// ============ RELATED (lateral exploration) ============
// Given a question, find prompts that share tags, ranked by tag overlap then
// score, so one good prompt leads to adjacent ones.
export async function getRelatedPrompts(
  id: number,
  limit?: number
): Promise<PromptWithTechnique[]> {
  const max = clamp(limit ?? 5, 1, 25);
  const supabase = createAdminClient();

  const { data: myTags } = await supabase
    .from("question_tags")
    .select("tag_id")
    .eq("question_id", id);
  const tagIds = (myTags ?? []).map((t: any) => t.tag_id);
  if (tagIds.length === 0) return [];

  const { data: links } = await supabase
    .from("question_tags")
    .select("question_id, tag_id")
    .in("tag_id", tagIds);

  // Count shared tags per other question.
  const overlap = new Map<number, number>();
  for (const l of (links ?? []) as any[]) {
    if (l.question_id === id) continue;
    overlap.set(l.question_id, (overlap.get(l.question_id) ?? 0) + 1);
  }
  if (overlap.size === 0) return [];

  const otherIds = Array.from(overlap.keys());
  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .in("id", otherIds)
    .not("prompt", "is", null);
  if (error) throw new Error(`getRelatedPrompts failed: ${error.message}`);

  const ranked = (data ?? [])
    .map(mapQuestionSummary)
    .sort((a, b) => {
      const ov = (overlap.get(b.id) ?? 0) - (overlap.get(a.id) ?? 0);
      return ov !== 0 ? ov : b.score - a.score;
    })
    .slice(0, max);

  const techniques = await fetchTechniques(
    supabase,
    ranked.map((r) => r.id)
  );
  return ranked.map((r) => ({
    ...r,
    technique: techniques.get(r.id) ?? null,
  }));
}

// ============ COMPOSE (active creativity) ============
// Given a goal, return the most relevant proven prompts + techniques as raw
// material for synthesizing a brand new prompt.
export async function composePrompts(
  goal: string,
  limit?: number
): Promise<Composition> {
  const max = clamp(limit ?? 5, 1, 10);
  const supabase = createAdminClient();

  // Gather candidates from full-text search on the goal, plus each salient
  // keyword, so we cast a wide but relevant net.
  const scored = new Map<number, { row: any; hits: number }>();

  async function collect(q: string, weight: number) {
    const { data } = await supabase
      .from("questions")
      .select(QUESTION_SELECT)
      .textSearch("search_tsv", q, { type: "websearch" })
      .not("prompt", "is", null)
      .limit(20);
    for (const row of data ?? []) {
      const existing = scored.get(row.id);
      if (existing) existing.hits += weight;
      else scored.set(row.id, { row, hits: weight });
    }
  }

  await collect(goal, 2);
  for (const kw of keywords(goal).slice(0, 6)) {
    await collect(kw, 1);
  }

  let ranked = Array.from(scored.values()).sort((a, b) => {
    const h = b.hits - a.hits;
    return h !== 0 ? h : (b.row.score ?? 0) - (a.row.score ?? 0);
  });

  // Fallback: if nothing matched, offer the top-voted prompts as inspiration.
  if (ranked.length === 0) {
    const { data } = await supabase
      .from("questions")
      .select(QUESTION_SELECT)
      .not("prompt", "is", null)
      .order("score", { ascending: false })
      .limit(max);
    ranked = (data ?? []).map((row: any) => ({ row, hits: 0 }));
  }

  const top = ranked.slice(0, max);
  const techniques = await fetchTechniques(
    supabase,
    top.map((t) => t.row.id)
  );

  const ingredients: PromptIngredient[] = top.map(({ row }) => {
    const summary = mapQuestionSummary(row);
    return {
      id: summary.id,
      title: summary.title,
      prompt: summary.prompt,
      technique: techniques.get(summary.id) ?? null,
      tags: summary.tags,
      score: summary.score,
      url: summary.url,
    };
  });

  const guidance =
    `You are composing a new prompt for this goal: "${goal}".\n\n` +
    `Below are ${ingredients.length} proven prompts from Prompt Overflow plus the ` +
    `community's refinements (techniques). Do not copy any one verbatim. Instead:\n` +
    `1. Identify the structural patterns that recur across them (role framing, ` +
    `explicit constraints, output format, "juice"/quality asks).\n` +
    `2. Pull in the specific techniques that fit the goal.\n` +
    `3. Synthesize a single, original prompt tailored to the goal, keeping the ` +
    `best constraints and dropping anything irrelevant.`;

  return { goal, ingredients, guidance };
}

// ============ PROMPT TEMPLATES (MCP prompts capability) ============
// Surface the top community prompts as invokable MCP prompt templates. Clients
// like Claude Code render these as slash commands the user/agent can fire.

const TEMPLATE_PREFIX = "po_"; // prompt-overflow namespace

function templateName(id: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${TEMPLATE_PREFIX}${id}_${slug}`;
}

function parseTemplateName(name: string): number | null {
  if (!name.startsWith(TEMPLATE_PREFIX)) return null;
  const rest = name.slice(TEMPLATE_PREFIX.length);
  const id = parseInt(rest.split("_")[0], 10);
  return Number.isInteger(id) ? id : null;
}

export async function listPromptTemplates(
  limit = 25
): Promise<PromptTemplate[]> {
  const max = clamp(limit, 1, 60);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id, title, prompt, score")
    .not("prompt", "is", null)
    .order("score", { ascending: false })
    .limit(max);
  if (error) throw new Error(`listPromptTemplates failed: ${error.message}`);

  return (data ?? []).map((q: any): PromptTemplate => ({
    name: templateName(q.id, q.title),
    title: q.title,
    description:
      `Community prompt (score ${q.score ?? 0}): ${String(q.prompt ?? "")
        .slice(0, 120)
        .replace(/\s+/g, " ")
        .trim()}…`,
  }));
}

// Return the messages payload for a single prompt template. Includes the proven
// technique from the accepted/top answer so the agent gets the refinement too.
export async function getPromptTemplate(name: string): Promise<{
  description: string;
  messages: { role: "user"; content: { type: "text"; text: string } }[];
} | null> {
  const id = parseTemplateName(name);
  if (id === null) return null;

  const question = await getQuestion(id);
  if (!question || !question.prompt) return null;

  const accepted =
    question.answers.find((a) => a.is_accepted) ?? question.answers[0] ?? null;
  const technique = accepted ? excerpt(accepted.body) : null;

  let text = question.prompt;
  if (technique) {
    text +=
      `\n\n---\nProven refinement from the Prompt Overflow community ` +
      `(from the ${accepted?.is_accepted ? "accepted" : "top"} answer):\n${technique}`;
  }

  return {
    description: `Prompt Overflow: ${question.title}`,
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}
