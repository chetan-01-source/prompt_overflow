import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { NotificationRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="main-content">
        <div className="page-header">
          <h1>Notifications</h1>
        </div>
        <p>
          You must be <Link href="/login">logged in</Link> to view notifications.
        </p>
      </div>
    );
  }

  // Fetch notifications with actor username and question title
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*, actor:profiles!notifications_actor_id_fkey(id, username), questions(id, title)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (notifications ?? []) as NotificationRow[];

  // Mark all notifications as read after fetching (so current view shows unread styling)
  await supabase.rpc("mark_notifications_read");

  return (
    <div className="main-content">
      <div className="page-header">
        <h1>Notifications</h1>
      </div>

      {rows.length === 0 ? (
        <div className="notif-empty">No notifications yet.</div>
      ) : (
        <div className="notif-list">
          {rows.map((notif) => {
            const questionId = notif.question_id;
            let href = questionId ? `/questions/${questionId}` : "#";
            if (questionId && notif.post_type === "answer" && notif.post_id) {
              href = `/questions/${questionId}#answer-${notif.post_id}`;
            } else if (questionId && notif.comment_id) {
              href = `/questions/${questionId}#comment`;
            }

            const actorUsername = notif.actor?.username ?? null;

            return (
              <Link
                key={notif.id}
                href={href}
                className={`notif-item${notif.is_read ? "" : " unread"}`}
              >
                <div className="notif-body">
                  {actorUsername && (
                    <span className="notif-actor">
                      <strong>{actorUsername}</strong> mentioned you:{" "}
                    </span>
                  )}
                  <span className="notif-snippet">{notif.snippet}</span>
                </div>
                <span className="notif-time">{timeAgo(notif.created_at)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
