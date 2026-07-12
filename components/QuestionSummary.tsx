import Link from "next/link";
import { timeAgo, formatCount, slugify } from "@/lib/format";
import type { Question } from "@/lib/types";

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function QuestionSummary({ question }: { question: Question }) {
  const answeredAccepted = question.accepted_answer_id != null;
  const answered = question.answer_count > 0;
  const author = question.profiles;
  const tags = (question.question_tags ?? []).map((qt) => qt.tags);

  return (
    <div className="question-summary" data-testid="question-summary">
      <div className="statscontainer">
        <div className="stats-box">
          <span className="mini-count">{formatCount(question.score)}</span>
          <span className="mini-label">votes</span>
        </div>
        <div
          className={`stats-box ${
            answeredAccepted ? "answered-accepted" : answered ? "answered" : ""
          }`}
        >
          <span className="mini-count">{formatCount(question.answer_count)}</span>
          <span className="mini-label">answers</span>
        </div>
        <div className={`stats-box ${question.view_count > 1000 ? "views-hot" : ""}`}>
          <span className="mini-count">{formatCount(question.view_count)}</span>
          <span className="mini-label">views</span>
        </div>
      </div>
      <div className="summary-body">
        <h3>
          <Link href={`/questions/${question.id}/${slugify(question.title)}`}>
            {question.title}
          </Link>
        </h3>
        <div className="excerpt">
          {stripMarkdown(question.body).slice(0, 200)}
        </div>
        <div className="summary-footer">
          <div className="post-taglist">
            {tags.map((tag) => (
              <Link key={tag.id} href={`/questions/tagged/${tag.name}`} className="post-tag">
                {tag.name}
              </Link>
            ))}
          </div>
          <div className="user-info">
            <div className="user-action-time">
              asked {timeAgo(question.created_at)}
            </div>
            {author && (
              <div>
                <Link href={`/users/${author.username}`}>{author.username}</Link>{" "}
                <span className="reputation-score">{formatCount(author.reputation)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
