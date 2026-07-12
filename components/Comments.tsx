"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/format";
import type { Comment } from "@/lib/types";
import { postComment, editComment } from "@/app/questions/[id]/actions";
import { createClient } from "@/lib/supabase/client";
import MentionTextarea from "@/components/MentionTextarea";

const MENTION_RE = /@([a-z0-9-]{3,30})/g;

/** Render comment body with @mention links (XSS-safe, no dangerouslySetInnerHTML). */
function CommentBody({ body }: { body: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, "g");
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    const username = match[1];
    parts.push(
      <Link key={match.index} href={`/users/${username}`} className="mention">
        @{username}
      </Link>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }
  return <>{parts}</>;
}

export default function Comments({
  postType,
  postId,
  comments,
  isLoggedIn,
  currentUserId,
  myCommentVotes,
}: {
  postType: "question" | "answer";
  postId: number;
  comments: Comment[];
  isLoggedIn: boolean;
  currentUserId: string | null;
  myCommentVotes: number[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Optimistic local state for scores and voted set
  const [scores, setScores] = useState<Record<number, number>>(() => {
    const m: Record<number, number> = {};
    for (const c of comments) m[c.id] = c.score;
    return m;
  });
  const [votedSet, setVotedSet] = useState<Set<number>>(
    () => new Set(myCommentVotes)
  );

  async function handleVote(commentId: number) {
    const supabase = createClient();
    const wasVoted = votedSet.has(commentId);
    // Optimistic update
    setScores((prev) => ({
      ...prev,
      [commentId]: (prev[commentId] ?? 0) + (wasVoted ? -1 : 1),
    }));
    setVotedSet((prev) => {
      const next = new Set(prev);
      if (wasVoted) next.delete(commentId);
      else next.add(commentId);
      return next;
    });

    const { data, error } = await supabase.rpc("cast_comment_vote", {
      p_comment_id: commentId,
    });
    if (error) {
      // Revert optimistic update
      setScores((prev) => ({
        ...prev,
        [commentId]: (prev[commentId] ?? 0) + (wasVoted ? 1 : -1),
      }));
      setVotedSet((prev) => {
        const next = new Set(prev);
        if (wasVoted) next.add(commentId);
        else next.delete(commentId);
        return next;
      });
      window.alert(error.message);
      return;
    }
    if (typeof data === "number") {
      setScores((prev) => ({ ...prev, [commentId]: data }));
    }
  }

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

  function startEdit(c: Comment) {
    setEditingId(c.id);
    setEditBody(c.body);
    setEditError(null);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId === null) return;
    setEditError(null);
    const trimmed = editBody.trim();
    if (trimmed.length < 15 || trimmed.length > 600) {
      setEditError("Comments must be between 15 and 600 characters.");
      return;
    }
    setEditSubmitting(true);
    const result = await editComment({ commentId: editingId, body: editBody });
    setEditSubmitting(false);
    if (result.error) {
      setEditError(result.error);
      return;
    }
    setEditingId(null);
    setEditBody("");
    router.refresh();
  }

  return (
    <div className="comments">
      {comments.map((c) => {
        const score = scores[c.id] ?? c.score;
        const isVoted = votedSet.has(c.id);
        const isOwn = currentUserId !== null && currentUserId === c.author_id;

        return (
          <div className="comment" key={c.id}>
            <button
              type="button"
              className={`comment-vote${isVoted ? " voted" : ""}`}
              disabled={!isLoggedIn || isOwn}
              onClick={() => handleVote(c.id)}
              aria-label="Upvote comment"
            >
              ▲
            </button>
            {score > 0 && <span className="comment-score-num">{score}</span>}
            {editingId === c.id ? (
              <form className="comment-edit-form" onSubmit={handleEditSubmit}>
                <MentionTextarea
                  value={editBody}
                  onChange={setEditBody}
                  rows={3}
                />
                {editError && <div className="form-error">{editError}</div>}
                <div className="edit-buttons">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={editSubmitting}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <span className="comment-copy">
                  <CommentBody body={c.body} />
                </span>
                {c.edited_at && (
                  <span className="comment-edited">(edited)</span>
                )}
              </>
            )}
            {" – "}
            {c.profiles ? (
              <Link
                className="comment-user"
                href={`/users/${c.profiles.username}`}
              >
                {c.profiles.username}
              </Link>
            ) : (
              <span className="comment-user">unknown</span>
            )}{" "}
            <span className="comment-date">{timeAgo(c.created_at)}</span>
            {isOwn && editingId !== c.id && (
              <span className="comment-actions">
                <a
                  href="#"
                  className="comment-edit-link"
                  onClick={(e) => {
                    e.preventDefault();
                    startEdit(c);
                  }}
                >
                  edit
                </a>
              </span>
            )}
          </div>
        );
      })}
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
          <MentionTextarea
            value={body}
            onChange={setBody}
            rows={3}
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
