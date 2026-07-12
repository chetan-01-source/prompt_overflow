import { test, expect } from "@playwright/test";

// MCP protocol tests against the baked-in server at /api/mcp

async function rpc(request: any, baseURL: string, method: string, params: any = {}, id = 1) {
  const res = await request.post(`${baseURL}/api/mcp`, {
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    data: { jsonrpc: "2.0", id, method, params },
  });
  const text = await res.text();
  // Handle SSE-style bodies
  if (text.startsWith("event:") || text.includes("\ndata:") || text.startsWith("data:")) {
    const dataLine = text.split("\n").find((l: string) => l.startsWith("data:"));
    return JSON.parse(dataLine!.slice(5).trim());
  }
  return JSON.parse(text);
}

test.describe("MCP server", () => {
  test("initialize handshake", async ({ request, baseURL }) => {
    const res = await rpc(request, baseURL!, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "e2e", version: "1.0" },
    });
    expect(res.result.serverInfo.name).toContain("prompt");
    expect(res.result.capabilities.tools).toBeDefined();
    expect(res.result.capabilities.prompts).toBeDefined();
  });

  test("tools/list exposes prompt browsing + creativity tools", async ({ request, baseURL }) => {
    const res = await rpc(request, baseURL!, "tools/list");
    const names = res.result.tools.map((t: any) => t.name);
    expect(names).toContain("list_prompts");
    expect(names).toContain("search_prompts");
    expect(names).toContain("get_question");
    expect(names).toContain("get_prompts_by_tag");
    expect(names).toContain("list_tags");
    expect(names).toContain("discover_prompts");
    expect(names).toContain("get_related_prompts");
    expect(names).toContain("compose_prompt");
  });

  test("list_prompts returns seeded prompts", async ({ request, baseURL }) => {
    const res = await rpc(request, baseURL!, "tools/call", {
      name: "list_prompts",
      arguments: { limit: 5 },
    });
    const text = res.result.content[0].text;
    const data = JSON.parse(text);
    const items = Array.isArray(data) ? data : data.prompts ?? data.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].prompt).toBeTruthy();
    expect(items[0].title).toBeTruthy();
  });

  test("search_prompts finds snake game", async ({ request, baseURL }) => {
    const res = await rpc(request, baseURL!, "tools/call", {
      name: "search_prompts",
      arguments: { query: "snake game" },
    });
    const text = res.result.content[0].text;
    expect(text.toLowerCase()).toContain("snake");
  });

  test("get_prompts_by_tag works", async ({ request, baseURL }) => {
    const res = await rpc(request, baseURL!, "tools/call", {
      name: "get_prompts_by_tag",
      arguments: { tag: "one-shot" },
    });
    const text = res.result.content[0].text;
    expect(text.length).toBeGreaterThan(50);
  });

  test("list_tags returns tags", async ({ request, baseURL }) => {
    const res = await rpc(request, baseURL!, "tools/call", {
      name: "list_tags",
      arguments: {},
    });
    const text = res.result.content[0].text;
    expect(text).toContain("claude");
  });

  test("compose_prompt returns ingredients and guidance", async ({ request, baseURL }) => {
    const res = await rpc(request, baseURL!, "tools/call", {
      name: "compose_prompt",
      arguments: { goal: "build a playable browser game", limit: 3 },
    });
    const comp = JSON.parse(res.result.content[0].text);
    expect(Array.isArray(comp.ingredients)).toBe(true);
    expect(typeof comp.guidance).toBe("string");
    expect(comp.guidance.length).toBeGreaterThan(20);
  });

  test("discover_prompts returns a sample", async ({ request, baseURL }) => {
    const res = await rpc(request, baseURL!, "tools/call", {
      name: "discover_prompts",
      arguments: { limit: 3 },
    });
    const items = JSON.parse(res.result.content[0].text);
    expect(Array.isArray(items)).toBe(true);
  });

  test("prompts capability: list and get", async ({ request, baseURL }) => {
    const list = await rpc(request, baseURL!, "prompts/list");
    expect(Array.isArray(list.result.prompts)).toBe(true);
    expect(list.result.prompts.length).toBeGreaterThan(0);
    const name = list.result.prompts[0].name;
    const got = await rpc(request, baseURL!, "prompts/get", { name });
    expect(Array.isArray(got.result.messages)).toBe(true);
    expect(got.result.messages[0].content.type).toBe("text");
    expect(got.result.messages[0].content.text.length).toBeGreaterThan(0);
  });
});
