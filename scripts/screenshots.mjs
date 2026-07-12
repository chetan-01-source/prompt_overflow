import { chromium } from "@playwright/test";
const base = process.argv[2] || "http://127.0.0.1:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
for (const [name, url] of [["home","/"],["question","/questions/2"],["tags","/tags"],["login","/login"]]) {
  await page.goto(base + url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/po-${name}.png` });
  console.log("shot", name);
}
await browser.close();
