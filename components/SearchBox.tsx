"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <input
        type="text"
        name="q"
        placeholder="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="search"
      />
    </form>
  );
}
