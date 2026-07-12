"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postAnswer } from "@/app/questions/[id]/actions";

export default function AnswerForm({
  questionId,
  isLoggedIn,
}: {
  questionId: number;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isLoggedIn) {
      setError("You must be logged in to answer.");
      return;
    }
    const trimmed = body.trim();
    if (trimmed.length < 15) {
      setError(
        `Body must be at least 15 characters; you entered ${trimmed.length}.`
      );
      return;
    }
    setSubmitting(true);
    const result = await postAnswer({ questionId, body, prompt });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBody("");
    setPrompt("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-item">
        <label htmlFor="answer-body">Body</label>
        <textarea
          id="answer-body"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="form-item">
        <label htmlFor="answer-prompt">Prompt (optional)</label>
        <textarea
          id="answer-prompt"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>
      {error && (
        <div className="form-error">
          {error}
          {!isLoggedIn && (
            <>
              {" "}
              <a href="/login">log in</a>
            </>
          )}
        </div>
      )}
      <button type="submit" className="btn-primary" disabled={submitting}>
        Post Your Answer
      </button>
    </form>
  );
}
