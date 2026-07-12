"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/format";
import type { Comment } from "@/lib/types";
import { postComment } from "@/app/questions/[id]/actions";

export default function Comments({
  postType,
  postId,
  comments,
  isLoggedIn,
}: {
  postType: "question" | "answer";
  postId: number;
  comments: Comment[];
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isLoggedIn) {
      setError("You must be logged in to comment.");
      return;
    }
    const trimmed = body.trim();
    if (trimmed.length < 15 || trimmed.length > 600) {
      setError("Comments must be between 15 and 600 characters.");
      return;
    }
    setSubmitting(true);
    const result = await postComment({ postType, postId, body });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBody("");
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="comments">
      {comments.map((c) => (
        <div className="comment" key={c.id}>
          {c.score > 0 && <span className="comment-score">{c.score}</span>}
          <span className="comment-copy">{c.body}</span>
          {" – "}
          {c.profiles ? (
            <Link className="comment-user" href={`/users/${c.profiles.username}`}>
              {c.profiles.username}
            </Link>
          ) : (
            <span className="comment-user">unknown</span>
          )}{" "}
          <span className="comment-date">{timeAgo(c.created_at)}</span>
        </div>
      ))}
      {!showForm && (
        <a
          className="add-comment-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setShowForm(true);
          }}
        >
          add a comment
        </a>
      )}
      {showForm && (
        <form className="comment-form" onSubmit={handleSubmit}>
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Use comments to ask for more information or suggest improvements."
          />
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
            Add Comment
          </button>
        </form>
      )}
    </div>
  );
}
