import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listPrompts,
  searchPrompts,
  getQuestion,
  getPromptsByTag,
  listTags,
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
      "Full-text search questions/prompts on Prompt Overflow by keywords.",
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
        capabilities: { tools: {} },
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
