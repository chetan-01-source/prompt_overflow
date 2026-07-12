import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 2000 } });
const shots = [
  ["so-home", "https://web.archive.org/web/20100610080730if_/http://stackoverflow.com/"],
  ["so-question", "https://web.archive.org/web/20100106143922if_/http://stackoverflow.com/questions/1995113/strangest-language-feature"],
];
for (const [name, url] of shots) {
  try {
    await page.goto(url, { waitUntil: "load", timeout: 90000 });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `/tmp/ref-${name}.png` });
    console.log("shot", name);
  } catch (e) { console.log("fail", name, e.message.slice(0, 100)); }
}
await browser.close();
