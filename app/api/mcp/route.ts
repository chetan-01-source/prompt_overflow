import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listPrompts,
  searchPrompts,
  getQuestion,
  getPromptsByTag,
  listTags,
  discoverPrompts,
  getRelatedPrompts,
  composePrompts,
  listPromptTemplates,
  getPromptTemplate,
} from "@/lib/mcp/data";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Stateless MCP server over streamable HTTP, implemented as plain JSON-RPC
// 2.0. The @modelcontextprotocol/sdk StreamableHTTPServerTransport expects
// Node req/res primitives which do not exist in Next.js route handlers, so
// we speak the protocol directly: initialize, notifications/initialized,
// tools/list, and tools/call are handled per-request with no session state.

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "prompt-overflow", version: "1.0.0" };

// JSON-RPC error codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

// ---- Tool definitions -------------------------------------------------

const listPromptsArgs = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  sort: z.enum(["newest", "votes"]).optional(),
});

const searchPromptsArgs = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});

const getQuestionArgs = z.object({
  id: z.number().int(),
});

const getPromptsByTagArgs = z.object({
  tag: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});

const listTagsArgs = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

const discoverPromptsArgs = z.object({
  theme: z.string().min(1).optional(),
  exclude_tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

const getRelatedPromptsArgs = z.object({
  id: z.number().int(),
  limit: z.number().int().min(1).max(25).optional(),
});

const composePromptsArgs = z.object({
  goal: z.string().min(1),
  limit: z.number().int().min(1).max(10).optional(),
});

const TOOLS = [
  {
    name: "list_prompts",
    description:
      "List shared prompts on Prompt Overflow. Returns questions that have a prompt attached, with title, prompt, artifact URL, score, tags, and author.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max results (1-100, default 20)",
        },
        offset: {
          type: "number",
          description: "Pagination offset (default 0)",
        },
        sort: {
          type: "string",
          enum: ["newest", "votes"],
          description: "Sort order (default 'newest')",
        },
      },
    },
  },
  {
    name: "search_prompts",
    description:
      "Full-text search across Prompt Overflow question titles, bodies, prompts, AND answer bodies. Each result includes the proven 'technique' excerpt from the accepted or top answer, plus 'matched_in' (prompt|answer|both). Use this to find not just prompts but the community refinements that make them work.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: {
          type: "number",
          description: "Max results (1-100, default 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_question",
    description:
      "Get a question with its prompt, body, and all answers (including answer prompts).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Question ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_prompts_by_tag",
    description: "List prompts for a tag (e.g. 'landing-page', 'nextjs').",
    inputSchema: {
      type: "object",
      properties: {
        tag: { type: "string", description: "Tag name" },
        limit: {
          type: "number",
          description: "Max results (1-100, default 20)",
        },
      },
      required: ["tag"],
    },
  },
  {
    name: "list_tags",
    description: "List tags on Prompt Overflow with question counts.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max results (1-200, default 50)",
        },
      },
    },
  },
  {
    name: "discover_prompts",
    description:
      "Get a RANDOMIZED sample of community prompts to spark lateral ideas and creativity. Pure browsing is deterministic; this injects serendipity. Optionally focus on a theme tag and/or exclude tags you have already explored. Each result carries its proven technique.",
    inputSchema: {
      type: "object",
      properties: {
        theme: {
          type: "string",
          description: "Optional tag to focus the sample on (e.g. 'game', 'agents')",
        },
        exclude_tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to exclude so you see fresh territory",
        },
        limit: {
          type: "number",
          description: "Sample size (1-25, default 5)",
        },
      },
    },
  },
  {
    name: "get_related_prompts",
    description:
      "Given a question id, find related prompts that share tags, ranked by tag overlap then score. Use this to explore laterally: one good prompt leads to adjacent proven ones.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Question ID to find neighbors of" },
        limit: {
          type: "number",
          description: "Max results (1-25, default 5)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "compose_prompt",
    description:
      "Given a goal, return the most relevant proven prompts plus their community techniques as raw ingredients, along with guidance for synthesizing a NEW original prompt for the goal. This turns the corpus into an active creative tool rather than a lookup.",
    inputSchema: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          description: "What you want the new prompt to achieve",
        },
        limit: {
          type: "number",
          description: "How many ingredient prompts to gather (1-10, default 5)",
        },
      },
      required: ["goal"],
    },
  },
];

async function dispatchTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "list_prompts": {
      const parsed = listPromptsArgs.parse(args);
      return listPrompts(parsed);
    }
    case "search_prompts": {
      const parsed = searchPromptsArgs.parse(args);
      return searchPrompts(parsed.query, parsed.limit);
    }
    case "get_question": {
      const parsed = getQuestionArgs.parse(args);
      const question = await getQuestion(parsed.id);
      if (!question) return { error: `Question ${parsed.id} not found` };
      return question;
    }
    case "get_prompts_by_tag": {
      const parsed = getPromptsByTagArgs.parse(args);
      return getPromptsByTag(parsed.tag, parsed.limit);
    }
    case "list_tags": {
      const parsed = listTagsArgs.parse(args);
      return listTags(parsed.limit);
    }
    case "discover_prompts": {
      const parsed = discoverPromptsArgs.parse(args);
      return discoverPrompts({
        theme: parsed.theme,
        excludeTags: parsed.exclude_tags,
        limit: parsed.limit,
      });
    }
    case "get_related_prompts": {
      const parsed = getRelatedPromptsArgs.parse(args);
      return getRelatedPrompts(parsed.id, parsed.limit);
    }
    case "compose_prompt": {
      const parsed = composePromptsArgs.parse(args);
      return composePrompts(parsed.goal, parsed.limit);
    }
    default:
      throw new ToolNotFoundError(name);
  }
}

class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`Unknown tool: ${name}`);
  }
}

// ---- JSON-RPC plumbing -------------------------------------------------

function rpcResult(id: number | string | null, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(
  id: number | string | null,
  code: number,
  message: string
) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleRpc(rpc: JsonRpcRequest): Promise<unknown | null> {
  const id = rpc.id ?? null;

  if (rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
    return rpcError(id, INVALID_REQUEST, "Invalid JSON-RPC 2.0 request");
  }

  switch (rpc.method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {}, prompts: {} },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      // Notifications get no response body.
      return null;

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: TOOLS });

    case "prompts/list": {
      // Surface top community prompts as invokable MCP prompt templates.
      const templates = await listPromptTemplates(25);
      return rpcResult(id, {
        prompts: templates.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
        })),
      });
    }

    case "prompts/get": {
      const params = (rpc.params ?? {}) as { name?: unknown };
      if (typeof params.name !== "string") {
        return rpcError(id, INVALID_PARAMS, "Missing prompt name");
      }
      try {
        const tpl = await getPromptTemplate(params.name);
        if (!tpl) {
          return rpcError(id, INVALID_PARAMS, `Unknown prompt: ${params.name}`);
        }
        return rpcResult(id, tpl);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return rpcError(id, INTERNAL_ERROR, message);
      }
    }

    case "tools/call": {
      const params = (rpc.params ?? {}) as {
        name?: unknown;
        arguments?: unknown;
      };
      if (typeof params.name !== "string") {
        return rpcError(id, INVALID_PARAMS, "Missing tool name");
      }
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await dispatchTool(params.name, args);
        return rpcResult(id, {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        });
      } catch (err) {
        if (err instanceof ToolNotFoundError) {
          return rpcError(id, INVALID_PARAMS, err.message);
        }
        if (err instanceof z.ZodError) {
          return rpcError(
            id,
            INVALID_PARAMS,
            `Invalid arguments: ${err.errors
              .map((e) => `${e.path.join(".")}: ${e.message}`)
              .join("; ")}`
          );
        }
        // Tool execution errors are reported in-band per MCP spec.
        const message = err instanceof Error ? err.message : String(err);
        return rpcResult(id, {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        });
      }
    }

    default:
      // Unknown notifications are silently accepted.
      if (rpc.method.startsWith("notifications/")) return null;
      return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${rpc.method}`);
  }
}

// ---- Route handlers ----------------------------------------------------

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, PARSE_ERROR, "Parse error"), {
      status: 400,
    });
  }

  try {
    // Support both single requests and batches.
    if (Array.isArray(body)) {
      const responses = (
        await Promise.all(body.map((r) => handleRpc(r as JsonRpcRequest)))
      ).filter((r) => r !== null);
      if (responses.length === 0) {
        return new NextResponse(null, { status: 202 });
      }
      return NextResponse.json(responses);
    }

    const response = await handleRpc(body as JsonRpcRequest);
    if (response === null) {
      // Notification: 202 Accepted with empty body.
      return new NextResponse(null, { status: 202 });
    }
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      rpcError(null, INTERNAL_ERROR, `Internal error: ${message}`),
      { status: 500 }
    );
  }
}

// Stateless server: no SSE stream to resume, no sessions to delete.
export async function GET() {
  return NextResponse.json(
    rpcError(null, METHOD_NOT_FOUND, "Method not allowed."),
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    rpcError(null, METHOD_NOT_FOUND, "Method not allowed."),
    { status: 405 }
  );
}
