// UI audit: detects element overlaps, horizontal overflow at mobile widths,
// and captures desktop + mobile screenshots.
// Usage: node scripts/ui-audit.mjs [baseUrl]
import { chromium } from "@playwright/test";

const base = process.argv[2] || "http://127.0.0.1:3000";
const PAGES = ["/", "/questions", "/questions/2", "/tags", "/users", "/users/vibecoder", "/search?q=snake", "/login", "/signup"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

let failures = 0;

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  for (const path of PAGES) {
    await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(800);

    // 1. Horizontal overflow check
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return { scrollW: doc.scrollWidth, clientW: doc.clientWidth };
    });
    if (overflow.scrollW > overflow.clientW + 1) {
      // find offenders
      const offenders = await page.evaluate(() => {
        const cw = document.documentElement.clientWidth;
        const bad = [];
        for (const el of document.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.right > cw + 1 && r.width > 40) {
            bad.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} right=${Math.round(r.right)}`);
            if (bad.length >= 5) break;
          }
        }
        return bad;
      });
      console.log(`FAIL [${vp.name}] ${path} horizontal overflow: ${overflow.scrollW}px > ${overflow.clientW}px :: ${offenders.join(", ")}`);
      failures++;
    } else {
      console.log(`PASS [${vp.name}] ${path} no horizontal overflow`);
    }

    // 2. Text overflow in stat boxes (the known overlap class)
    const statIssues = await page.evaluate(() => {
      const issues = [];
      for (const box of document.querySelectorAll(".stats-box")) {
        const br = box.getBoundingClientRect();
        for (const child of box.querySelectorAll("*")) {
          const cr = child.getBoundingClientRect();
          if (cr.bottom > br.bottom + 1.5 || cr.top < br.top - 1.5) {
            issues.push(`stats-box child ${child.className} overflows vertically (${Math.round(cr.bottom - br.bottom)}px)`);
          }
        }
      }
      return [...new Set(issues)].slice(0, 3);
    });
    if (statIssues.length) {
      console.log(`FAIL [${vp.name}] ${path} stat box overflow: ${statIssues.join("; ")}`);
      failures++;
    }

    // 3. Overlapping siblings audit on key rows (question-summary, votecell, post-layout)
    const overlaps = await page.evaluate(() => {
      function rectsOverlap(a, b) {
        const xo = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const yo = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return xo > 3 && yo > 3 ? xo * yo : 0;
      }
      const results = [];
      const containers = document.querySelectorAll(".question-summary, .post-layout, .topbar-wrapper, .header, .summary-footer");
      for (const c of containers) {
        const kids = [...c.children].filter((k) => {
          const s = getComputedStyle(k);
          return s.position === "static" && s.display !== "none" && k.getBoundingClientRect().width > 0;
        });
        for (let i = 0; i < kids.length; i++) {
          for (let j = i + 1; j < kids.length; j++) {
            const area = rectsOverlap(kids[i].getBoundingClientRect(), kids[j].getBoundingClientRect());
            if (area > 100) {
              results.push(
                `${c.className.split(" ")[0]}: ${kids[i].className.toString().split(" ")[0] || kids[i].tagName} overlaps ${kids[j].className.toString().split(" ")[0] || kids[j].tagName} (${Math.round(area)}px2)`
              );
            }
          }
        }
      }
      return [...new Set(results)].slice(0, 5);
    });
    if (overlaps.length) {
      console.log(`FAIL [${vp.name}] ${path} sibling overlap: ${overlaps.join("; ")}`);
      failures++;
    }
  }
  // screenshots of key pages per viewport
  for (const [name, path] of [["home", "/"], ["question", "/questions/2"], ["questions", "/questions"]]) {
    await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `/tmp/audit-${vp.name}-${name}.png`, fullPage: vp.name === "mobile" });
  }
  await page.close();
}
await browser.close();

console.log(failures === 0 ? "\nAUDIT PASSED" : `\nAUDIT FAILED: ${failures} issue groups`);
process.exit(failures === 0 ? 0 : 1);
