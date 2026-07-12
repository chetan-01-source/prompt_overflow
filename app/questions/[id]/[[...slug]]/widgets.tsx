"use client";

export function CopyPromptButton({ prompt }: { prompt: string }) {
  return (
    <button
      type="button"
      className="copy-prompt-btn"
      onClick={() => {
        navigator.clipboard.writeText(prompt).catch(() => {});
      }}
    >
      copy
    </button>
  );
}

export function ShareLink() {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard
          .writeText(window.location.href.split("#")[0])
          .catch(() => {});
      }}
      title="Short permalink to this question"
    >
      share
    </a>
  );
}
