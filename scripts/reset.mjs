// Danger: wipes all Prompt Overflow content and test/seed users, then leaves the
// DB empty so scripts/seed.mjs can repopulate authentic sample data.
// Preserves real human accounts (anything not matching the e2e/seed/test patterns)
// but removes ALL of their content too, so the site starts from a clean slate.
// Usage: node scripts/reset.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Auth users that are clearly test/seed/bot accounts and safe to delete entirely.
const DELETABLE_EMAIL = /^(e2e|mcp-bot@|.*@example\.com$)/i;

async function delAll(table, filterCol = "id", gt = 0) {
  const { error } = await admin.from(table).delete().gt(filterCol, gt);
  if (error && !/no rows/i.test(error.message)) console.warn(`  ${table}: ${error.message}`);
}

async function main() {
  console.log("Wiping content tables...");
  // Order respects FKs (votes/comments/answers/question_tags reference questions).
  await delAll("votes");
  await delAll("comments");
  // Clear accepted_answer_id links before deleting answers to avoid FK contention.
  await admin.from("questions").update({ accepted_answer_id: null }).gt("id", 0);
  await delAll("answers");
  await delAll("question_tags", "question_id");
  await delAll("questions");
  await delAll("tags");
  console.log("  content cleared");

  console.log("Removing test/seed auth users...");
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let removed = 0;
  for (const u of data.users) {
    if (DELETABLE_EMAIL.test(u.email || "")) {
      const { error } = await admin.auth.admin.deleteUser(u.id);
      if (error) console.warn(`  del ${u.email}: ${error.message}`);
      else removed++;
    } else {
      console.log(`  keeping real account: ${u.email}`);
    }
  }
  console.log(`  removed ${removed} test/seed users`);
  console.log("Reset complete. Run: node scripts/seed.mjs");
}

main().catch((e) => {
  console.error("RESET FAILED:", e.message);
  process.exit(1);
});
