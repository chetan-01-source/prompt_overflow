export const dynamic = "force-dynamic";

import { CopyPrompt } from "./CopyPrompt";

const CONNECTION_PROMPT = `Add an MCP server named "prompt-overflow" using the streamable HTTP transport at https://promptoverflow.info/api/mcp. Once connected, use its tools (search_prompts, list_prompts, get_prompts_by_tag, get_question) to find proven prompts on Prompt Overflow for ideation and context whenever I ask you to build something. Prefer real examples from the site over inventing prompts from scratch.`;

const PROD_CONFIG = `{
  "mcpServers": {
    "prompt-overflow": {
      "url": "https://promptoverflow.info/api/mcp"
    }
  }
}`;

const LOCAL_CONFIG = `{
  "mcpServers": {
    "prompt-overflow": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}`;

const TOOLS = `list_prompts          List recent questions that include a prompt, newest first.
search_prompts        Full-text search across question titles, bodies, and prompts.
get_question          Fetch a single question with its prompt, answers, and accepted answer.
get_prompts_by_tag    List prompts for questions filed under a given tag.
list_tags             List all tags with descriptions and question counts.`;

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

        {/* ---- Connect your agent ---- */}
        <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "10px" }}>
          Connect your agent
        </h2>
        <p style={{ marginBottom: "8px" }}>
          Paste the prompt below into Claude Code, Cursor, or any MCP-compatible
          agent to connect it to Prompt Overflow and pull real prompts for context:
        </p>

        <div className="mcp-prompt-box">
          <div className="mcp-prompt-header">
            <span>COPY THIS INTO YOUR AGENT</span>
            <CopyPrompt text={CONNECTION_PROMPT} />
          </div>
          <pre>{CONNECTION_PROMPT}</pre>
        </div>

        <p style={{ marginBottom: "8px" }}>
          Or add this JSON to your agent&rsquo;s MCP config file (production):
        </p>

        <div className="mcp-prompt-box">
          <div className="mcp-prompt-header">
            <span>MCP CONFIG (JSON) &mdash; PRODUCTION</span>
            <CopyPrompt text={PROD_CONFIG} />
          </div>
          <pre>{PROD_CONFIG}</pre>
        </div>

        {/* ---- Available tools ---- */}
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

        {/* ---- Local-dev config ---- */}
        <p style={{ marginBottom: "8px" }}>
          Local development config (points to <code>localhost:3000</code>):
        </p>
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
          {LOCAL_CONFIG}
        </pre>

        <p style={{ marginBottom: "12px" }}>
          Agents can read every question, answer, and prompt on the site through
          these tools.
        </p>
      </div>
    </div>
  );
}
