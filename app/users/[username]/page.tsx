import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { avatarColor } from "@/components/UserSignature";
import { timeAgo, slugify } from "@/lib/format";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

type ProfileQuestion = {
  id: number;
  title: string;
  score: number;
  created_at: string;
};

type ProfileAnswer = {
  id: number;
  score: number;
  created_at: string;
  questions: { id: number; title: string } | null;
};

export default async function UserProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", params.username)
    .single();

  if (!profile) notFound();
  const user = profile as Profile;

  const [questionsRes, answersRes, questionCountRes, answerCountRes] =
    await Promise.all([
      supabase
        .from("questions")
        .select("id, title, score, created_at")
        .eq("author_id", user.id)
        .order("score", { ascending: false })
        .limit(10),
      supabase
        .from("answers")
        .select("id, score, created_at, questions(id, title)")
        .eq("author_id", user.id)
        .order("score", { ascending: false })
        .limit(10),
      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("author_id", user.id),
      supabase
        .from("answers")
        .select("id", { count: "exact", head: true })
        .eq("author_id", user.id),
    ]);

  const questions = (questionsRes.data ?? []) as ProfileQuestion[];
  const answers = (answersRes.data ?? []) as unknown as ProfileAnswer[];
  const questionCount = questionCountRes.count ?? 0;
  const answerCount = answerCountRes.count ?? 0;

  return (
    <div className="main-content" style={{ width: "100%", borderRight: "none" }}>
      <div className="profile-header">
        <div
          className="user-gravatar"
          style={{
            background: avatarColor(user.username),
            width: 96,
            height: 96,
            fontSize: 44,
          }}
        >
          {user.username.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1>{user.username}</h1>
          <div style={{ fontSize: "13px", color: "#666" }}>
            member for {timeAgo(user.created_at).replace(" ago", "")}
          </div>
          {user.location && (
            <div style={{ fontSize: "13px", color: "#666" }}>{user.location}</div>
          )}
          {user.website_url && (
            <div style={{ fontSize: "13px" }}>
              <a href={user.website_url}>{user.website_url}</a>
            </div>
          )}
        </div>
      </div>

      <div className="profile-stats">
        <div className="stat">
          <strong>{user.reputation}</strong> reputation
        </div>
        <div className="stat">
          <strong>{questionCount}</strong> questions
        </div>
        <div className="stat">
          <strong>{answerCount}</strong> answers
        </div>
      </div>

      {user.about_me && (
        <p style={{ fontSize: "13px", margin: "12px 0" }}>{user.about_me}</p>
      )}

      <div className="profile-section">
        <h2>Questions ({questionCount})</h2>
        {questions.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#999" }}>
            No questions asked yet.
          </div>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="profile-post-row">
              <span
                className={`profile-post-score${q.score === 0 ? " zero" : ""}`}
              >
                {q.score}
              </span>
              <Link href={`/questions/${q.id}/${slugify(q.title)}`}>
                {q.title}
              </Link>
              <span style={{ marginLeft: "auto", color: "#999", fontSize: "11px" }}>
                {timeAgo(q.created_at)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="profile-section">
        <h2>Answers ({answerCount})</h2>
        {answers.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#999" }}>
            No answers posted yet.
          </div>
        ) : (
          answers.map((a) => (
            <div key={a.id} className="profile-post-row">
              <span
                className={`profile-post-score${a.score === 0 ? " zero" : ""}`}
              >
                {a.score}
              </span>
              {a.questions ? (
                <Link
                  href={`/questions/${a.questions.id}/${slugify(a.questions.title)}#answer-${a.id}`}
                >
                  {a.questions.title}
                </Link>
              ) : (
                <span>[deleted question]</span>
              )}
              <span style={{ marginLeft: "auto", color: "#999", fontSize: "11px" }}>
                {timeAgo(a.created_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
