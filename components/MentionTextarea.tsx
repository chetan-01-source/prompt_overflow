"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { avatarColor } from "@/components/UserSignature";

type Suggestion = { username: string };

export default function MentionTextarea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mentionToken, setMentionToken] = useState<string | null>(null);
  const [tokenStart, setTokenStart] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const detectMention = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const text = el.value.slice(0, pos);
    const match = text.match(/@([a-z0-9-]{0,30})$/);
    if (match) {
      const prefix = match[1];
      setTokenStart(pos - match[0].length);
      setMentionToken(prefix);
    } else {
      setMentionToken(null);
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (mentionToken === null || mentionToken.length === 0) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const controller = new AbortController();
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/mentions?q=${encodeURIComponent(mentionToken)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data: Suggestion[] = await res.json();
          setSuggestions(data);
          setActiveIdx(0);
        }
      } catch (err) {
        // An aborted request means a newer token superseded this one; leave the
        // suggestions alone so the in-flight lookup for that token can fill them.
        if ((err as Error)?.name === "AbortError") return;
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Cancels the request too, not just the pending timer, so a slow response
      // for an older token can never overwrite a newer one.
      controller.abort();
    };
  }, [mentionToken]);

  function insertMention(username: string) {
    const el = textareaRef.current;
    if (!el) return;
    const before = value.slice(0, tokenStart);
    const after = value.slice(el.selectionStart);
    const newValue = `${before}@${username} ${after}`;
    onChange(newValue);
    setSuggestions([]);
    setMentionToken(null);
    // Restore cursor after React re-render
    const cursorPos = tokenStart + username.length + 2; // @username + space
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = cursorPos;
      el.selectionEnd = cursorPos;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(suggestions[activeIdx].username);
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setMentionToken(null);
    }
  }

  return (
    <div className="mention-wrap">
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setTimeout(detectMention, 0);
        }}
        onKeyDown={handleKeyDown}
        onClick={detectMention}
        placeholder={placeholder}
      />
      {suggestions.length > 0 && (
        <div className="mention-menu" ref={menuRef}>
          {suggestions.map((s, i) => (
            <div
              key={s.username}
              className={`mention-menu-item${i === activeIdx ? " active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(s.username);
              }}
            >
              <span
                className="mini-gravatar"
                style={{ background: avatarColor(s.username) }}
              >
                {s.username.slice(0, 1)}
              </span>
              {s.username}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
