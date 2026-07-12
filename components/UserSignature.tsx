import Link from "next/link";
import { timeAgo } from "@/lib/format";
import type { Profile } from "@/lib/types";

const COLORS = ["#5b8fa8", "#77b055", "#cf7721", "#8b6bb1", "#c05555", "#4a8f7b"];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function UserSignature({
  profile,
  actionLabel,
  actionTime,
  isOwner = false,
}: {
  profile: Profile | undefined;
  actionLabel: string;
  actionTime: string;
  isOwner?: boolean;
}) {
  if (!profile) return null;
  return (
    <div className={`post-signature ${isOwner ? "owner" : ""}`}>
      <div className="action-time">
        {actionLabel} {timeAgo(actionTime)}
      </div>
      <div className="user-card">
        <div
          className="user-gravatar"
          style={{ background: avatarColor(profile.username) }}
        >
          {profile.username.slice(0, 1)}
        </div>
        <div className="user-details">
          <Link href={`/users/${profile.username}`}>{profile.username}</Link>
          <div>
            <span className="reputation-score">{profile.reputation}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
