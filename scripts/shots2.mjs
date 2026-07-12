import { chromium } from "@playwright/test";
const base = process.argv[2] || "http://127.0.0.1:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const shots = [["home","/"],["questions","/questions"],["question","/questions/2"],["tags","/tags"],["users","/users"],["ask","/signup"],["search","/search?q=snake"],["profile","/users/vibecoder"]];
for (const [name, url] of shots) {
  await page.goto(base + url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `/tmp/ui-${name}.png`, fullPage: true });
  console.log("shot", name);
}
await browser.close();
