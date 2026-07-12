"use client";

import { useState } from "react";

export function CopyPrompt({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button className="mcp-copy-btn" type="button" onClick={handleClick}>
      {copied ? "copied!" : "copy"}
    </button>
  );
}
