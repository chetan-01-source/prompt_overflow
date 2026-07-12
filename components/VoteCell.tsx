"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VoteCell({
  postType,
  postId,
  score,
  myVote,
  canAccept = false,
  isAccepted = false,
  isQuestionOwner = false,
}: {
  postType: "question" | "answer";
  postId: number;
  score: number;
  myVote: -1 | 0 | 1;
  canAccept?: boolean;
  isAccepted?: boolean;
  isQuestionOwner?: boolean;
}) {
  const router = useRouter();
  const [currentScore, setCurrentScore] = useState(score);
  const [vote, setVote] = useState<-1 | 0 | 1>(myVote);

  const upTitle =
    postType === "question"
      ? "This question shows research effort; it is useful and clear"
      : "This answer is useful";
  const downTitle =
    postType === "question"
      ? "This question does not show any research effort; it is unclear or not useful"
      : "This answer is not useful";

  async function castVote(voteType: 1 | -1) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("cast_vote", {
      p_post_type: postType,
      p_post_id: postId,
      p_vote_type: voteType,
    });
    if (error) {
      window.alert(error.message);
      return;
    }
    if (typeof data === "number") setCurrentScore(data);
    setVote((prev) => (prev === voteType ? 0 : voteType));
    router.refresh();
  }

  async function acceptAnswer() {
    const supabase = createClient();
    const { error } = await supabase.rpc("accept_answer", {
      p_answer_id: postId,
    });
    if (error) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="votecell">
      <button
        type="button"
        className={`vote-btn vote-up ${vote === 1 ? "voted" : ""}`}
        title={upTitle}
        aria-label="Vote up"
        onClick={() => castVote(1)}
      />
      <div className="vote-count">{currentScore}</div>
      <button
        type="button"
        className={`vote-btn vote-down ${vote === -1 ? "voted" : ""}`}
        title={downTitle}
        aria-label="Vote down"
        onClick={() => castVote(-1)}
      />
      {canAccept && (
        <div
          className={`accepted-check ${isAccepted ? "accepted" : ""} ${
            isQuestionOwner ? "" : "not-owner"
          }`}
          title={
            isQuestionOwner
              ? "Accept this answer"
              : isAccepted
              ? "The question owner accepted this as the best answer"
              : ""
          }
          onClick={acceptAnswer}
        >
          ✔
        </div>
      )}
    </div>
  );
}
