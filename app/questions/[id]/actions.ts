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
  const { error } = await supabase.from("comments").insert({
    post_type: postType,
    post_id: postId,
    author_id: user.id,
    body,
  });
  if (error) {
    return { error: friendlyError(error.message, "comment") };
  }
  if (postType === "question") {
    revalidatePath(`/questions/${postId}`);
  } else {
    const { data: answer } = await supabase
      .from("answers")
      .select("question_id")
      .eq("id", postId)
      .single();
    if (answer) revalidatePath(`/questions/${answer.question_id}`);
  }
  return {};
}
