"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function friendlyError(message: string, kind: "answer" | "comment"): string {
  const msg = message.toLowerCase();
  if (msg.includes("row-level security") || msg.includes("not authorized")) {
    return kind === "answer"
      ? "You must be logged in to answer."
      : "You must be logged in to comment.";
  }
  if (msg.includes("check constraint") || msg.includes("violates check")) {
    return kind === "answer"
      ? "Body must be at least 15 characters."
      : "Comments must be between 15 and 600 characters.";
  }
  return message;
}

export async function postAnswer({
  questionId,
  body,
  prompt,
}: {
  questionId: number;
  body: string;
  prompt?: string;
}): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in to answer." };
  }
  if (body.trim().length < 15) {
    return {
      error: `Body must be at least 15 characters; you entered ${body.trim().length}.`,
    };
  }
  const { error } = await supabase.from("answers").insert({
    question_id: questionId,
    author_id: user.id,
    body,
    prompt: prompt && prompt.trim().length > 0 ? prompt : null,
  });
  if (error) {
    return { error: friendlyError(error.message, "answer") };
  }
  revalidatePath(`/questions/${questionId}`);
  return {};
}

/** Parse distinct @username tokens from comment body. */
function parseMentions(body: string): string[] {
  const re = /@([a-z0-9-]{3,30})/g;
  const usernames = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    usernames.add(match[1]);
  }
  return Array.from(usernames);
}

export async function postComment({
  postType,
  postId,
  body,
}: {
  postType: "question" | "answer";
  postId: number;
  body: string;
}): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in to comment." };
  }
  const trimmed = body.trim();
  if (trimmed.length < 15 || trimmed.length > 600) {
    return { error: "Comments must be between 15 and 600 characters." };
  }
  const { data: inserted, error } = await supabase
    .from("comments")
    .insert({
      post_type: postType,
      post_id: postId,
      author_id: user.id,
      body,
    })
    .select("id")
    .single();
  if (error) {
    return { error: friendlyError(error.message, "comment") };
  }

  // Resolve question_id for mention notifications
  let questionId: number;
  if (postType === "question") {
    questionId = postId;
  } else {
    const { data: answer } = await supabase
      .from("answers")
      .select("question_id")
      .eq("id", postId)
      .single();
    questionId = answer?.question_id ?? 0;
  }

  // Send @mention notifications. Must complete before the action returns
  // (unawaited promises in server actions are not guaranteed to run), but a
  // failure here must never block the comment from being posted.
  const usernames = parseMentions(body);
  if (usernames.length > 0 && inserted?.id && questionId > 0) {
    try {
      await supabase.rpc("notify_mentions", {
        p_comment_id: inserted.id,
        p_question_id: questionId,
        p_usernames: usernames,
      });
    } catch {
      // Ignore notification failures.
    }
  }

  // Revalidate the question page
  if (postType === "question") {
    revalidatePath(`/questions/${postId}`);
  } else if (questionId > 0) {
    revalidatePath(`/questions/${questionId}`);
  }
  return {};
}

export async function editComment({
  commentId,
  body,
}: {
  commentId: number;
  body: string;
}): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in to edit a comment." };
  }
  const trimmed = body.trim();
  if (trimmed.length < 15 || trimmed.length > 600) {
    return { error: "Comments must be between 15 and 600 characters." };
  }
  const { data: updated, error } = await supabase
    .from("comments")
    .update({
      body,
      edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("author_id", user.id)
    .select("post_type, post_id")
    .single();
  if (error) {
    return { error: friendlyError(error.message, "comment") };
  }
  if (!updated) {
    return { error: "Comment not found or you are not the author." };
  }

  // Revalidate the question page
  if (updated.post_type === "question") {
    revalidatePath(`/questions/${updated.post_id}`);
  } else {
    const { data: answer } = await supabase
      .from("answers")
      .select("question_id")
      .eq("id", updated.post_id)
      .single();
    if (answer) revalidatePath(`/questions/${answer.question_id}`);
  }
  return {};
}
