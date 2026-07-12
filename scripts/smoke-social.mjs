// Smoke test for social features. Exercises the new DB surface AS REAL USERS
// (anon key + password sign-in), so RLS + RPCs are validated end-to-end.
// Usage: node scripts/smoke-social.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(SB_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "seedpass123!";
let pass = 0, fail = 0;
function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}

function userClient() {
  return createClient(SB_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function signIn(email) {
  const c = userClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}

async function main() {
  console.log("== Setup: pick two seeded users and a question ==");
  const { data: qs } = await admin.from("questions").select("id, author_id, title").limit(20);
  if (!qs?.length) throw new Error("No seeded questions. Run scripts/seed.mjs first.");

  // Only use seeded accounts (@example.com), which share the seed password.
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const seedAuth = authList.users.filter((u) => /@example\.com$/i.test(u.email || ""));
  const emailById = Object.fromEntries(seedAuth.map((u) => [u.id, u.email]));
  const seedIds = new Set(seedAuth.map((u) => u.id));
  const { data: allProfiles } = await admin.from("profiles").select("id, username").order("created_at");
  const users = (allProfiles ?? []).filter((p) => seedIds.has(p.id));
  if (users.length < 2) throw new Error("Need >=2 seeded @example.com users. Run scripts/seed.mjs first.");

  const userA = users[0];
  const userB = users.find((u) => u.id !== userA.id);
  const emailA = emailById[userA.id];
  const emailB = emailById[userB.id];
  // Question NOT authored by A or B, so both can comment/vote freely.
  const q = qs.find((x) => x.author_id !== userA.id && x.author_id !== userB.id) || qs[0];
  console.log(`  userA=${userA.username} userB=${userB.username} question#${q.id}`);

  const cA = await signIn(emailA);
  const cB = await signIn(emailB);

  console.log("\n== 1) username -> email resolution (anon RPC) ==");
  const anon = userClient();
  const { data: resolved } = await anon.rpc("email_for_username", { p_username: userA.username });
  ok("email_for_username returns email for known user", resolved === emailA, `(got ${resolved})`);
  const { data: resolvedMixed } = await anon.rpc("email_for_username", { p_username: userA.username.toUpperCase() });
  ok("email_for_username is case-insensitive", resolvedMixed === emailA, `(got ${resolvedMixed})`);
  const { data: resolvedNone } = await anon.rpc("email_for_username", { p_username: "no-such-user-xyz" });
  ok("email_for_username returns null for unknown", resolvedNone === null, `(got ${resolvedNone})`);

  console.log("\n== 2) A comments (with @mention of B), notification created for B ==");
  const body = `Great work @${userB.username}, this is a smoke-test comment that is long enough.`;
  const { data: inserted, error: insErr } = await cA
    .from("comments")
    .insert({ post_type: "question", post_id: q.id, author_id: userA.id, body })
    .select("id")
    .single();
  ok("A can insert a comment", !insErr && inserted?.id, insErr?.message || "");
  const commentId = inserted?.id;

  const { data: notifCount, error: nErr } = await cA.rpc("notify_mentions", {
    p_comment_id: commentId,
    p_question_id: q.id,
    p_usernames: [userB.username],
  });
  ok("notify_mentions returns 1 (B mentioned)", !nErr && notifCount === 1, nErr?.message || `(got ${notifCount})`);

  // B should see the notification; A should NOT see B's notifications (RLS).
  const { data: bNotifs } = await cB.from("notifications").select("id, type, is_read, comment_id").eq("comment_id", commentId);
  ok("B sees the mention notification (RLS)", (bNotifs?.length ?? 0) === 1, `(got ${bNotifs?.length})`);
  ok("notification is unread + type mention", bNotifs?.[0]?.is_read === false && bNotifs?.[0]?.type === "mention");
  const { data: aSeesB } = await cA.from("notifications").select("id").eq("comment_id", commentId);
  ok("A cannot see B's notifications (RLS)", (aSeesB?.length ?? 0) === 0, `(got ${aSeesB?.length})`);

  console.log("\n== 3) self-mention creates no notification ==");
  const { data: selfCount } = await cA.rpc("notify_mentions", {
    p_comment_id: commentId, p_question_id: q.id, p_usernames: [userA.username],
  });
  ok("self-mention -> 0 notifications", selfCount === 0, `(got ${selfCount})`);

  console.log("\n== 4) comment voting ==");
  // B upvotes A's comment
  const { data: score1, error: vErr } = await cB.rpc("cast_comment_vote", { p_comment_id: commentId });
  ok("B upvotes A's comment -> score 1", !vErr && score1 === 1, vErr?.message || `(got ${score1})`);
  // B toggles off
  const { data: score0 } = await cB.rpc("cast_comment_vote", { p_comment_id: commentId });
  ok("B toggles vote off -> score 0", score0 === 0, `(got ${score0})`);
  // Re-add for later checks
  await cB.rpc("cast_comment_vote", { p_comment_id: commentId });
  // A cannot vote own comment
  const { error: selfVoteErr } = await cA.rpc("cast_comment_vote", { p_comment_id: commentId });
  ok("A cannot upvote own comment", !!selfVoteErr && /own comment/i.test(selfVoteErr.message), selfVoteErr?.message || "(no error!)");
  // anon cannot vote
  const { error: anonVoteErr } = await anon.rpc("cast_comment_vote", { p_comment_id: commentId });
  ok("anon cannot vote", !!anonVoteErr, anonVoteErr?.message || "(no error!)");

  console.log("\n== 5) comment editing ==");
  const newBody = body + " (edited with more content here).";
  const { error: editErr } = await cA
    .from("comments")
    .update({ body: newBody, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", commentId);
  ok("A can edit own comment", !editErr, editErr?.message || "");
  const { data: editedRow } = await admin.from("comments").select("body, edited_at").eq("id", commentId).single();
  ok("comment body updated + edited_at set", editedRow?.body === newBody && !!editedRow?.edited_at);
  // B cannot edit A's comment (RLS update policy)
  const { error: bEditErr } = await cB.from("comments").update({ body: "hijack attempt that is long enough here" }).eq("id", commentId);
  const { data: afterHijack } = await admin.from("comments").select("body").eq("id", commentId).single();
  ok("B cannot edit A's comment (RLS)", afterHijack?.body === newBody, `(body changed to: ${afterHijack?.body?.slice(0,20)})`);

  console.log("\n== 6) username change keeps login working ==");
  // Change A's username, then verify email_for_username resolves the new name and not implicitly broken.
  const newName = `smoke-${Date.now().toString(36)}`.slice(0, 20);
  const oldName = userA.username;
  const { error: renErr } = await cA.from("profiles").update({ username: newName }).eq("id", userA.id);
  ok("A can change own username", !renErr, renErr?.message || "");
  const { data: newResolved } = await anon.rpc("email_for_username", { p_username: newName });
  ok("login-by-new-username resolves to same email", newResolved === emailA, `(got ${newResolved})`);
  const { data: oldResolved } = await anon.rpc("email_for_username", { p_username: oldName });
  ok("old username no longer resolves", oldResolved === null, `(got ${oldResolved})`);
  // restore
  await cA.from("profiles").update({ username: oldName }).eq("id", userA.id);

  console.log("\n== Cleanup ==");
  await admin.from("notifications").delete().eq("comment_id", commentId);
  await admin.from("comment_votes").delete().eq("comment_id", commentId);
  await admin.from("comments").delete().eq("id", commentId);
  console.log("  cleaned up smoke-test rows");

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("SMOKE FAILED:", e.message); process.exit(1); });
