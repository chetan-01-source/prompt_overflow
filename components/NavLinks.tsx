"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks() {
  const pathname = usePathname();

  const questionsCurrent =
    pathname.startsWith("/questions") || pathname.startsWith("/search");
  const tagsCurrent = pathname.startsWith("/tags");
  const usersCurrent = pathname.startsWith("/users");

  return (
    <>
      <Link href="/questions" className={questionsCurrent ? "current" : undefined}>
        Questions
      </Link>
      <Link href="/tags" className={tagsCurrent ? "current" : undefined}>
        Tags
      </Link>
      <Link href="/users" className={usersCurrent ? "current" : undefined}>
        Users
      </Link>
    </>
  );
}
