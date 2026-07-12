"use server";

import { createClient } from "@/lib/supabase/server";

const TAG_RE = /^[a-z0-9][a-z0-9-.+#]{0,34}$/;
const MAX_TAGS = 5;

export type AskQuestionInput = {
  title: string;
  body: string;
  prompt: string;
  artifactUrl: string;
  tags: string[];
};

export type AskQuestionResult = { id: number } | { error: string };

function friendlyDbError(message: string): string {
  if (message.includes("questions_title_check")) {
    return "Title must be between 15 and 150 characters.";
  }
  if (message.includes("questions_body_check")) {
    return "Body must be at least 30 characters.";
  }
  if (message.includes("tags_name_check")) {
    return "Tags must start with a letter or number and use only lowercase letters, numbers, and - . + #";
  }
  if (message.includes("row-level security")) {
    return "You must be logged in to ask a question.";
  }
  return "Something went wrong posting your question. Please try again.";
}

export async function askQuestion(
  input: AskQuestionInput
): Promise<AskQuestionResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in to ask a question." };
  }

  const title = input.title.trim();
  const body = input.body.trim();
  const prompt = input.prompt.trim();
  const artifactUrl = input.artifactUrl.trim();

  if (title.length < 15 || title.length > 150) {
    return { error: "Title must be between 15 and 150 characters." };
  }
  if (body.length < 30) {
    return { error: "Body must be at least 30 characters." };
  }

  // Normalize and validate tags before touching the database.
  const tagNames = Array.from(
    new Set(
      input.tags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0)
    )
  );
  if (tagNames.length > MAX_TAGS) {
    return { error: `Please use no more than ${MAX_TAGS} tags.` };
  }
  for (const name of tagNames) {
    if (!TAG_RE.test(name)) {
      return {
        error: `'${name}' is not a valid tag name. Tags must start with a letter or number and use only lowercase letters, numbers, and - . + #`,
      };
    }
  }

  const { data: question, error: insertError } = await supabase
    .from("questions")
    .insert({
      author_id: user.id,
      title,
      body,
      prompt: prompt.length > 0 ? prompt : null,
      artifact_url: artifactUrl.length > 0 ? artifactUrl : null,
    })
    .select("id")
    .single();

  if (insertError || !question) {
    return { error: friendlyDbError(insertError?.message ?? "") };
  }

  for (const name of tagNames) {
    let tagId: number | null = null;

    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      tagId = existing.id;
    } else {
      const { data: created, error: tagError } = await supabase
        .from("tags")
        .insert({ name })
        .select("id")
        .single();
      if (tagError) {
        // Possible race: another request created the tag first. Re-select.
        const { data: retry } = await supabase
          .from("tags")
          .select("id")
          .eq("name", name)
          .maybeSingle();
        tagId = retry?.id ?? null;
      } else {
        tagId = created?.id ?? null;
      }
    }

    if (tagId != null) {
      await supabase
        .from("question_tags")
        .insert({ question_id: question.id, tag_id: tagId });
    }
  }

  return { id: question.id };
}
