import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(raw, {
    allowedTags: [
      "a", "b", "blockquote", "br", "code", "del", "em", "h1", "h2", "h3",
      "h4", "h5", "h6", "hr", "i", "img", "kbd", "li", "ol", "p", "pre",
      "strong", "sub", "sup", "table", "tbody", "td", "th", "thead", "tr", "ul",
    ],
    allowedAttributes: {
      a: ["href", "title", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      code: ["class"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noreferrer" }),
    },
  });
}
