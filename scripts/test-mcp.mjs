#!/usr/bin/env node
// Standalone smoke test for the Prompt Overflow MCP server.
// Usage: node scripts/test-mcp.mjs [baseUrl]   (default http://localhost:3000)

const baseUrl = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
let endpoint = `${baseUrl}/api/mcp`;

// On some machines `localhost` resolves to ::1 while the server only accepts
// IPv4 (or vice versa). Probe once and fall back to 127.0.0.1 if needed.
async function resolveEndpoint() {
  if (!/\/\/localhost[:/]/.test(baseUrl + "/")) return;
  try {
    await fetch(endpoint, { method: "HEAD" });
  } catch {
    const fallback = `${baseUrl.replace("//localhost", "//127.0.0.1")}/api/mcp`;
    try {
      await fetch(fallback, { method: "HEAD" });
      console.log(`(localhost unreachable, using ${fallback})`);
      endpoint = fallback;
    } catch {
      // keep original endpoint; failures will surface per-step
    }
  }
}

let failures = 0;
let nextId = 1;

function pass(name, detail = "") {
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  failures++;
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

// Parse either application/json or text/event-stream ("data: {...}" lines).
async function parseBody(res) {
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const messages = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const payload = trimmed.slice(5).trim();
        if (payload && payload !== "[DONE]") {
          messages.push(JSON.parse(payload));
        }
      }
    }
    // Return the last JSON-RPC message (the response).
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }
  if (!text) return null;
  return JSON.parse(text);
}

async function rpc(method, params, { notification = false } = {}) {
  const body = { jsonrpc: "2.0", method };
  if (params !== undefined) body.params = params;
  if (!notification) body.id = nextId++;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
  const parsed = await parseBody(res).catch((err) => {
    throw new Error(`unparseable response (HTTP ${res.status}): ${err.message}`);
  });
  return { status: res.status, body: parsed };
}

function toolText(result) {
  const content = result?.content;
  if (!Array.isArray(content)) return null;
  const textPart = content.find((c) => c?.type === "text");
  return textPart?.text ?? null;
}

async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    fail(name, err.message);
  }
}

async function main() {
  await resolveEndpoint();
  console.log(`Testing MCP server at ${endpoint}\n`);

  // 1. initialize
  await step("initialize", async () => {
    const { status, body } = await rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-mcp", version: "1.0.0" },
    });
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (body?.error) throw new Error(`RPC error: ${body.error.message}`);
    const r = body?.result;
    if (!r?.protocolVersion) throw new Error("missing protocolVersion");
    if (r?.serverInfo?.name !== "prompt-overflow") {
      throw new Error(`unexpected serverInfo: ${JSON.stringify(r?.serverInfo)}`);
    }
    pass("initialize", `protocolVersion=${r.protocolVersion}`);
  });

  // 1b. notifications/initialized (should be accepted, no result required)
  await step("notifications/initialized", async () => {
    const { status } = await rpc("notifications/initialized", undefined, {
      notification: true,
    });
    if (status !== 202 && status !== 200) throw new Error(`HTTP ${status}`);
    pass("notifications/initialized", `HTTP ${status}`);
  });

  // 2. tools/list
  await step("tools/list", async () => {
    const { status, body } = await rpc("tools/list", {});
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (body?.error) throw new Error(`RPC error: ${body.error.message}`);
    const tools = body?.result?.tools;
    if (!Array.isArray(tools)) throw new Error("result.tools is not an array");
    if (tools.length !== 5) {
      throw new Error(
        `expected 5 tools, got ${tools.length}: ${tools.map((t) => t.name).join(", ")}`
      );
    }
    const expected = [
      "list_prompts",
      "search_prompts",
      "get_question",
      "get_prompts_by_tag",
      "list_tags",
    ];
    const names = tools.map((t) => t.name);
    for (const e of expected) {
      if (!names.includes(e)) throw new Error(`missing tool: ${e}`);
    }
    for (const t of tools) {
      if (!t.inputSchema || t.inputSchema.type !== "object") {
        throw new Error(`tool ${t.name} missing valid inputSchema`);
      }
    }
    pass("tools/list", `5 tools: ${names.join(", ")}`);
  });

  // 3. tools/call list_prompts
  await step("tools/call list_prompts", async () => {
    const { status, body } = await rpc("tools/call", {
      name: "list_prompts",
      arguments: { limit: 5 },
    });
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (body?.error) throw new Error(`RPC error: ${body.error.message}`);
    if (body?.result?.isError) {
      throw new Error(`tool error: ${toolText(body.result)}`);
    }
    const text = toolText(body?.result);
    if (text === null) throw new Error("no text content in result");
    const prompts = JSON.parse(text);
    if (!Array.isArray(prompts)) throw new Error("result is not an array");
    for (const p of prompts) {
      if (typeof p.id !== "number" || typeof p.title !== "string") {
        throw new Error(`malformed prompt entry: ${JSON.stringify(p)}`);
      }
      if (typeof p.url !== "string" || !p.url.startsWith("/questions/")) {
        throw new Error(`malformed url: ${p.url}`);
      }
    }
    pass("tools/call list_prompts", `${prompts.length} prompts`);
  });

  // 4. tools/call search_prompts
  await step("tools/call search_prompts", async () => {
    const { status, body } = await rpc("tools/call", {
      name: "search_prompts",
      arguments: { query: "landing page", limit: 5 },
    });
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (body?.error) throw new Error(`RPC error: ${body.error.message}`);
    if (body?.result?.isError) {
      throw new Error(`tool error: ${toolText(body.result)}`);
    }
    const text = toolText(body?.result);
    if (text === null) throw new Error("no text content in result");
    const results = JSON.parse(text);
    if (!Array.isArray(results)) throw new Error("result is not an array");
    pass("tools/call search_prompts", `${results.length} results for 'landing page'`);
  });

  // 5. tools/call list_tags
  await step("tools/call list_tags", async () => {
    const { status, body } = await rpc("tools/call", {
      name: "list_tags",
      arguments: {},
    });
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (body?.error) throw new Error(`RPC error: ${body.error.message}`);
    if (body?.result?.isError) {
      throw new Error(`tool error: ${toolText(body.result)}`);
    }
    const text = toolText(body?.result);
    if (text === null) throw new Error("no text content in result");
    const tags = JSON.parse(text);
    if (!Array.isArray(tags)) throw new Error("result is not an array");
    for (const t of tags) {
      if (typeof t.name !== "string") {
        throw new Error(`malformed tag entry: ${JSON.stringify(t)}`);
      }
    }
    pass("tools/call list_tags", `${tags.length} tags`);
  });

  // 6. GET should return 405 with a JSON-RPC error
  await step("GET returns 405", async () => {
    const res = await fetch(endpoint, { method: "GET" });
    if (res.status !== 405) throw new Error(`HTTP ${res.status}, expected 405`);
    const body = await parseBody(res);
    if (!body?.error) throw new Error("missing JSON-RPC error body");
    pass("GET returns 405");
  });

  console.log("");
  if (failures > 0) {
    console.log(`${failures} step(s) FAILED`);
    process.exit(1);
  }
  console.log("All steps PASSED");
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
