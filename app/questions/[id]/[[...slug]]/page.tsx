import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderMarkdown } from "@/lib/markdown";
import { timeAgo, askedTimestamp, formatCount, slugify } from "@/lib/format";
import type { Answer, Comment, Question } from "@/lib/types";
import UserSignature from "@/components/UserSignature";
import VoteCell from "@/components/VoteCell";
import AnswerForm from "@/components/AnswerForm";
import Comments from "@/components/Comments";
import { CopyPromptButton, ShareLink } from "./widgets";

export const dynamic = "force-dynamic";

type VoteRow = {
  post_type: "question" | "answer";
  post_id: number;
  vote_type: -1 | 1;
};

function PromptBox({ prompt }: { prompt: string }) {
  return (
    <div className="prompt-box">
      <div className="prompt-box-header">
        <span>THE PROMPT</span>
        <CopyPromptButton prompt={prompt} />
      </div>
      <pre>{prompt}</pre>
    </div>
  );
}

export default async function QuestionPage({
  params,
}: {
  params: { id: string; slug?: string[] };
}) {
  const questionId = Number(params.id);
  if (!Number.isInteger(questionId) || questionId <= 0) notFound();

  const supabase = createClient();

  const { data: question } = (await supabase
    .from("questions")
    .select("*, profiles(*), question_tags(tags(*))")
    .eq("id", questionId)
    .single()) as { data: Question | null };

  if (!question) notFound();

  // Fire and forget view count increment.
  void supabase
    .rpc("increment_view_count", { p_question_id: questionId })
    .then(() => {});

  const [{ data: answersData }, userResult] = await Promise.all([
    supabase
      .from("answers")
      .select("*, profiles(*)")
      .eq("question_id", questionId)
      .order("is_accepted", { ascending: false })
      .order("score", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  const answers = (answersData ?? []) as Answer[];
  const user = userResult.data.user;
  const isLoggedIn = !!user;
  const isQuestionOwner = !!user && user.id === question.author_id;

  const answerIds = answers.map((a) => a.id);

  const [questionCommentsRes, answerCommentsRes, votesRes] = await Promise.all([
    supabase
      .from("comments")
      .select("*, profiles(*)")
      .eq("post_type", "question")
      .eq("post_id", questionId)
      .order("created_at", { ascending: true }),
    answerIds.length > 0
      ? supabase
          .from("comments")
          .select("*, profiles(*)")
          .eq("post_type", "answer")
          .in("post_id", answerIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    user
      ? supabase
          .from("votes")
          .select("post_type, post_id, vote_type")
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
  ]);

  const questionComments = (questionCommentsRes.data ?? []) as Comment[];
  const answerComments = (answerCommentsRes.data ?? []) as Comment[];
  const votes = (votesRes.data ?? []) as VoteRow[];

  const myVote = (postType: "question" | "answer", postId: number): -1 | 0 | 1 =>
    votes.find((v) => v.post_type === postType && v.post_id === postId)
      ?.vote_type ?? 0;

  const commentsFor = (answerId: number) =>
    answerComments.filter((c) => c.post_id === answerId);

  const tags = (question.question_tags ?? []).map((qt) => qt.tags);
  const questionUrl = `/questions/${question.id}/${slugify(question.title)}`;
  const answerCount = answers.length;

  return (
    <>
      <div className="main-content">
        <div className="question-header">
          <h1>
            <Link href={questionUrl}>{question.title}</Link>
          </h1>
          <div className="question-facts">
            <span>Asked {timeAgo(question.created_at)}</span>
            <span>Viewed {formatCount(question.view_count)} times</span>
          </div>
        </div>

        <div className="post-layout">
          <VoteCell
            postType="question"
            postId={question.id}
            score={question.score}
            myVote={myVote("question", question.id)}
          />
          <div className="postcell">
            <div
              className="post-text"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(question.body) }}
            />
            {question.prompt && <PromptBox prompt={question.prompt} />}
            {question.artifact_url && (
              <div className="artifact-link">
                🔗 Built with this prompt:{" "}
                <a href={question.artifact_url} rel="nofollow noreferrer">
                  {question.artifact_url}
                </a>
              </div>
            )}
            <div className="post-taglist">
              {tags.map((tag) => (
                <Link key={tag.id} className="post-tag" href={`/questions/tagged/${tag.name}`}>
                  {tag.name}
                </Link>
              ))}
            </div>
            <div className="post-footer">
              <div className="post-menu">
                <ShareLink />
                {isQuestionOwner && <a href="#">edit</a>}
              </div>
              <UserSignature
                profile={question.profiles}
                actionLabel="asked"
                actionTime={question.created_at}
                isOwner
              />
            </div>
            <Comments
              postType="question"
              postId={question.id}
              comments={questionComments}
              isLoggedIn={isLoggedIn}
            />
          </div>
        </div>

        <div className="answers-header">
          <h2>
            {answerCount} {answerCount === 1 ? "Answer" : "Answers"}
          </h2>
        </div>

        {answers.map((answer) => (
          <div
            key={answer.id}
            className={`answer ${answer.is_accepted ? "accepted-answer" : ""}`}
            id={`answer-${answer.id}`}
          >
            <div className="post-layout">
              <VoteCell
                postType="answer"
                postId={answer.id}
                score={answer.score}
                myVote={myVote("answer", answer.id)}
                canAccept
                isAccepted={answer.is_accepted}
                isQuestionOwner={isQuestionOwner}
              />
              <div className="postcell">
                <div
                  className="post-text"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(answer.body),
                  }}
                />
                {answer.prompt && <PromptBox prompt={answer.prompt} />}
                <div className="post-footer">
                  <div className="post-menu">
                    <ShareLink />
                    {user && user.id === answer.author_id && <a href="#">edit</a>}
                  </div>
                  <UserSignature
                    profile={answer.profiles}
                    actionLabel="answered"
                    actionTime={answer.created_at}
                  />
                </div>
                <Comments
                  postType="answer"
                  postId={answer.id}
                  comments={commentsFor(answer.id)}
                  isLoggedIn={isLoggedIn}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="your-answer">
          <h2>Your Answer</h2>
          <AnswerForm questionId={question.id} isLoggedIn={isLoggedIn} />
        </div>
      </div>

      <div className="sidebar">
        <div className="sidebar-module">
          <h4>Question stats</h4>
          <table>
            <tbody>
              <tr>
                <td>asked</td>
                <td>
                  <b title={askedTimestamp(question.created_at)}>
                    {timeAgo(question.created_at)}
                  </b>
                </td>
              </tr>
              <tr>
                <td>viewed</td>
                <td>
                  <b>{formatCount(question.view_count)} times</b>
                </td>
              </tr>
              <tr>
                <td>active</td>
                <td>
                  <b>{timeAgo(question.last_activity_at)}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="yellow-box">
          Know someone who can answer? Share a{" "}
          <Link href={questionUrl}>link</Link> to this question.
        </div>
      </div>
    </>
  );
}
