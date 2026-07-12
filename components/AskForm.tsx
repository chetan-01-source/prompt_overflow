"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { askQuestion } from "@/app/ask/actions";
import { slugify } from "@/lib/format";

export default function AskForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState("");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 15) {
      setError("Title must be at least 15 characters.");
      return;
    }
    if (body.trim().length < 30) {
      setError("Body must be at least 30 characters.");
      return;
    }

    setSubmitting(true);
    const result = await askQuestion({
      title: title.trim(),
      body: body.trim(),
      prompt,
      artifactUrl,
      tags: tags.split(/\s+/).filter((t) => t.length > 0),
    });

    if ("error" in result) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    router.push(`/questions/${result.id}/${slugify(title)}`);
    router.refresh();
  }

  return (
    <form className="form-page" onSubmit={handleSubmit}>
      <div className="form-item">
        <label htmlFor="title">Title</label>
        <div className="form-hint">
          Be specific: what did your prompt build?
        </div>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
          required
        />
      </div>
      <div className="form-item">
        <label htmlFor="body">Body</label>
        <div className="form-hint">
          describe what you built and how the prompt got you there. markdown is supported.
        </div>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
      </div>
      <div className="form-item">
        <label htmlFor="prompt">The Prompt</label>
        <div className="form-hint">
          Paste the exact prompt that produced your result. This is what Prompt
          Overflow is for.
        </div>
        <textarea
          id="prompt"
          className="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>
      <div className="form-item">
        <label htmlFor="artifact-url">Link to what it made</label>
        <div className="form-hint">optional, but seeing is believing</div>
        <input
          id="artifact-url"
          type="url"
          value={artifactUrl}
          onChange={(e) => setArtifactUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>
      <div className="form-item">
        <label htmlFor="tags">Tags</label>
        <div className="form-hint">
          up to 5 tags, space separated, e.g. landing-page claude nextjs
        </div>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-item">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "posting..." : "Post Your Prompt"}
        </button>
      </div>
    </form>
  );
}
