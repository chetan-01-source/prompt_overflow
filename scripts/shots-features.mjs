import { chromium } from "@playwright/test";
const base = process.argv[2] || "http://127.0.0.1:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
for (const [name, url] of [["login", "/login"], ["mcp", "/mcp-info"], ["settings", "/settings"]]) {
  await page.goto(base + url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `/tmp/po-feat-${name}.png`, fullPage: true });
  console.log("shot", name);
}
// magic-link tab
await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await page.locator(".auth-tab", { hasText: /magic link/i }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/po-feat-magic.png" });
console.log("shot magic");
await browser.close();
