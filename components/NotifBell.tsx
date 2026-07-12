"use client";

import Link from "next/link";

interface NotifBellProps {
  unreadCount: number;
}

export default function NotifBell({ unreadCount }: NotifBellProps) {
  const badge = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <Link href="/notifications" className="notif-bell" aria-label={`Notifications${unreadCount > 0 ? ` (${badge} unread)` : ""}`}>
      🔔
      {badge && <span className="notif-badge">{badge}</span>}
    </Link>
  );
}
