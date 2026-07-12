export const dynamic = "force-dynamic";

const TOOLS = `list_prompts          List recent questions that include a prompt, newest first.
search_prompts        Full-text search across question titles, bodies, and prompts.
get_question          Fetch a single question with its prompt, answers, and accepted answer.
get_prompts_by_tag    List prompts for questions filed under a given tag.
list_tags             List all tags with descriptions and question counts.`;

const CONFIG = `{
  "mcpServers": {
    "prompt-overflow": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}`;

export default function McpInfoPage() {
  return (
    <div className="main-content" style={{ width: "100%", borderRight: "none" }}>
      <div className="page-header">
        <h1>MCP Server</h1>
      </div>
      <div style={{ fontSize: "14px", lineHeight: 1.5, maxWidth: 700 }}>
        <p style={{ marginBottom: "12px" }}>
          Prompt Overflow ships a built-in Model Context Protocol (MCP) server at{" "}
          <code>POST /api/mcp</code> using the streamable HTTP transport. Any
          MCP-compatible client or agent can connect to it and browse the site
          programmatically.
        </p>
        <p style={{ marginBottom: "8px" }}>Available tools:</p>
        <pre
          style={{
            background: "#f6f6f6",
            border: "1px solid #ddd",
            padding: "10px",
            fontSize: "12px",
            overflowX: "auto",
            marginBottom: "12px",
          }}
        >
          {TOOLS}
        </pre>
        <p style={{ marginBottom: "8px" }}>Example client configuration:</p>
        <pre
          style={{
            background: "#f6f6f6",
            border: "1px solid #ddd",
            padding: "10px",
            fontSize: "12px",
            overflowX: "auto",
            marginBottom: "12px",
          }}
        >
          {CONFIG}
        </pre>
        <p style={{ marginBottom: "12px" }}>
          Agents can read every question, answer, and prompt on the site through
          these tools.
        </p>
      </div>
    </div>
  );
}
