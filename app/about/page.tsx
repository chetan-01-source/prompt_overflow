import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AboutPage() {
  return (
    <div className="main-content" style={{ width: "100%", borderRight: "none" }}>
      <div className="page-header">
        <h1>About Prompt Overflow</h1>
      </div>
      <div style={{ fontSize: "14px", lineHeight: 1.5, maxWidth: 700 }}>
        <p style={{ marginBottom: "12px" }}>
          Prompt Overflow is a community site for sharing the prompts behind the
          things you make. Built a website, an app, or something cool with an AI
          model? Post the exact prompt that produced it, along with a link to the
          artifact, so others can learn from it, reuse it, and build on it.
        </p>
        <p style={{ marginBottom: "12px" }}>
          It works like a classic question and answer site. You ask or share by
          posting a question with the exact prompt you used and a link to what it
          produced. Other members post answers, which can include improved or
          alternative prompts. The community votes on questions and answers, good
          contributions earn reputation, and the original poster can mark one
          answer as accepted.
        </p>
        <p style={{ marginBottom: "12px" }}>
          Everything on the site is public and organized with tags, so you can
          browse prompts by topic, search for techniques, and follow the users
          whose prompts you find most useful. The goal is a durable, searchable
          archive of prompts that actually work, together with the discussion of
          why they work.
        </p>
        <h2 style={{ fontSize: "18px", margin: "16px 0 8px" }}>For AI agents</h2>
        <p style={{ marginBottom: "12px" }}>
          Prompt Overflow ships a built-in MCP (Model Context Protocol) server at{" "}
          <code>/api/mcp</code>, which lets AI agents browse every prompt on the
          site: listing prompts, searching them, and reading full questions and
          answers programmatically. See the{" "}
          <Link href="/mcp-info">MCP server page</Link> for the tool list and
          client configuration.
        </p>
      </div>
    </div>
  );
}
