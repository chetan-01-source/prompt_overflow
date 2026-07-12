import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2];
}
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: qs } = await a.from("questions").select("id,title,score,view_count,created_at,accepted_answer_id").order("created_at",{ascending:false});
console.log("QUESTIONS (newest first):");
for (const q of qs) {
  const days = Math.round((Date.now()-new Date(q.created_at))/86400000);
  console.log(`  score=${String(q.score).padStart(3)} views=${String(q.view_count).padStart(4)} ${days}d ago ${q.accepted_answer_id?"[accepted]":"          "} ${q.title.slice(0,50)}`);
}
const { data: profs } = await a.from("profiles").select("username,reputation").order("reputation",{ascending:false});
console.log("\nUSERS by reputation:");
for (const p of profs) console.log(`  ${String(p.reputation).padStart(4)} ${p.username}`);
