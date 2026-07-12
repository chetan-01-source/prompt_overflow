// Seed Prompt Overflow with realistic users, questions (with prompts), answers, votes, comments.
// Usage: node scripts/seed.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env.local
const env = {};
for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  { username: "promptsmith", email: "promptsmith@example.com" },
  { username: "vibecoder", email: "vibecoder@example.com" },
  { username: "lena-builds", email: "lena-builds@example.com" },
  { username: "agentwrangler", email: "agentwrangler@example.com" },
  { username: "onepromptwonder", email: "onepromptwonder@example.com" },
  { username: "shipfast", email: "shipfast@example.com" },
  // Community voters: give the site an authentic spread of engagement.
  { username: "mira_dev", email: "mira_dev@example.com" },
  { username: "tokenwrangler", email: "tokenwrangler@example.com" },
  { username: "designbynight", email: "designbynight@example.com" },
  { username: "the_debugger", email: "the_debugger@example.com" },
  { username: "coffee_compiler", email: "coffee_compiler@example.com" },
  { username: "async_annie", email: "async_annie@example.com" },
  { username: "sudo_sam", email: "sudo_sam@example.com" },
  { username: "pixelpusher", email: "pixelpusher@example.com" },
  { username: "regex_rob", email: "regex_rob@example.com" },
  { username: "nullpointer", email: "nullpointer@example.com" },
  { username: "gradient_grace", email: "gradient_grace@example.com" },
  { username: "shipittoprod", email: "shipittoprod@example.com" },
];

const PASSWORD = "seedpass123!";

const TAGS = [
  ["landing-page", "Questions about prompts that generate landing pages and marketing sites."],
  ["claude", "Prompts used with Anthropic's Claude family of models."],
  ["nextjs", "Prompts that produce Next.js applications."],
  ["game", "Prompts that build playable games."],
  ["one-shot", "Single-prompt builds: no follow-ups, one prompt in, working artifact out."],
  ["data-viz", "Prompts producing charts, dashboards, and visualizations."],
  ["css", "Prompts focused on styling and visual design."],
  ["agents", "Prompts for building or driving AI agents."],
  ["threejs", "Prompts that generate 3D scenes with three.js."],
  ["python", "Prompts producing Python programs."],
];

const QUESTIONS = [
  {
    author: "promptsmith",
    title: "One-shot prompt that builds a complete SaaS landing page with pricing table",
    body: `I kept iterating on landing page prompts and finally landed on one that reliably produces a polished SaaS landing page in a single shot: hero, feature grid, pricing table, FAQ, and footer, all responsive.

The trick was specifying the visual hierarchy explicitly instead of just saying "make it look good". Sharing the exact prompt below. It has worked across three different models for me.

What would you add to make the testimonials section less generic?`,
    prompt: `Build a single-file HTML landing page for a SaaS product called {PRODUCT}. Requirements:
- Hero: bold headline (max 8 words), subheadline (max 20 words), primary CTA button, product screenshot placeholder with subtle drop shadow
- Social proof bar: 5 grayscale company logos
- Feature grid: 3 columns, each with an icon, 4-word heading, 2-sentence description
- Pricing: 3 tiers (Free/Pro/Team), middle tier visually emphasized, annual toggle
- FAQ: 5 questions in an accordion
- Footer: 4 columns of links
Design constraints: system font stack, one accent color #4f46e5, 8px spacing grid, max-width 1120px, generous whitespace, no stock-photo cliches. All copy must be specific to {PRODUCT}, no lorem ipsum.`,
    artifact_url: "https://example.com/saas-landing-demo",
    tags: ["landing-page", "one-shot", "css"],
    views: 2841,
  },
  {
    author: "vibecoder",
    title: "Prompt that makes Claude generate a playable Snake game with juice and screen shake",
    body: `Most snake-game prompts give you a joyless gray grid. I wanted arcade feel: particles, screen shake, an actual difficulty curve.

After a lot of trial and error the prompt below consistently produces a genuinely fun version. The key insight was asking for "game juice" by name and enumerating the specific effects.

Anyone have a variant that adds sound without breaking the single-file constraint?`,
    prompt: `Create a complete Snake game in a single HTML file with canvas. Beyond the basics, it must have GAME JUICE:
- screen shake on death (200ms, decaying)
- particle burst when eating food
- the snake's head slightly overshoots turns (squash & stretch)
- food pulses at 1Hz
- score popup floats up and fades when eating
- speed increases 4% per food eaten
- CRT scanline overlay effect
- start screen and game-over screen with high score in localStorage
Controls: arrows + WASD + swipe on mobile. 60fps game loop with requestAnimationFrame and fixed timestep. No external assets or libraries.`,
    artifact_url: "https://example.com/snake-juice",
    tags: ["game", "claude", "one-shot"],
    views: 5210,
  },
  {
    author: "lena-builds",
    title: "How do I prompt for a Next.js dashboard that doesn't look like every other admin template?",
    body: `Every time I ask for "a dashboard in Next.js" I get the same shadcn-flavored gray boxes. I built a genuinely distinctive analytics dashboard using the prompt below, which forces an editorial, print-inspired design direction.

It specifies typography, a strict palette, and bans the usual suspects. Posting because the "design bans" technique changed everything for me.

Still struggling with: how do you keep the charts on-theme? Mine revert to default library colors half the time.`,
    prompt: `Build a Next.js 14 analytics dashboard page with an EDITORIAL PRINT design language, not a generic admin template. Hard rules:
- Typography-first: big serif display numerals (Playfair Display) for KPIs, tight grotesque (Inter) for labels
- Palette: paper #faf7f2, ink #1a1a1a, one accent #d64541. Nothing else.
- BANNED: card drop shadows, rounded-xl, gradient buttons, sidebar with icons, gray-50 backgrounds
- Layout: asymmetric 12-col grid like a newspaper front page, KPIs as a "masthead" row, hairline rules (1px #1a1a1a) as separators
- Charts: sparklines and bar charts drawn as inline SVG, ink-colored, accent only for the current period
- Data: mock a realistic e-commerce dataset in a separate ts file
Ship it as app/dashboard/page.tsx plus components. It must build with zero errors.`,
    artifact_url: null,
    tags: ["nextjs", "data-viz", "css"],
    views: 1893,
  },
  {
    author: "agentwrangler",
    title: "Prompt for an agent that reviews PRs and actually finds real bugs, not style nits",
    body: `I run this as the system prompt for a code-review agent hooked to our CI. Before this, 90% of its comments were style nitpicks nobody wanted. The reframing that fixed it: make the agent predict runtime behavior, not critique text.

With this prompt it has caught two real race conditions and an off-by-one in pagination in the last month.

Curious what failure modes others have found with review agents. Mine still occasionally hallucinates a function that doesn't exist.`,
    prompt: `You are a senior engineer reviewing a pull request. Your ONLY job is finding defects that change runtime behavior. Style, naming, and formatting are out of scope entirely.

Method, in order:
1. Read the diff and write down what the author intended (one sentence).
2. For each changed function, trace one happy path and two edge cases (empty input, concurrent call, max size) through the ACTUAL code line by line.
3. For each state mutation, ask: who else reads this state, and can they observe an intermediate value?
4. For each async boundary, ask: what happens if this resolves after the component unmounts / request ends?
5. Only report findings you can demonstrate with a concrete input and the resulting incorrect output. Format: [severity] file:line - input X produces Y, expected Z.
If you find nothing demonstrable, say "No behavioral defects found" and stop. Never suggest refactors.`,
    artifact_url: null,
    tags: ["agents", "one-shot"],
    views: 3567,
  },
  {
    author: "onepromptwonder",
    title: "Three.js solar system with orbit controls from a single prompt - sharing what finally worked",
    body: `Getting a correct-feeling solar system out of one prompt is surprisingly hard: you either get planets orbiting at the same speed or a camera stuck inside the sun.

This prompt gets the scale relationships readable (not realistic, readable) and the camera behavior right on the first try in most runs. The explicit "logarithmic compromise" instruction is doing the heavy lifting.`,
    prompt: `Create a three.js solar system in one HTML file (import three from CDN as ES module). Requirements:
- Sun + 8 planets with LOGARITHMIC COMPROMISE scaling: planet radii proportional to log of real radii, orbital distances proportional to log of real distances, so everything is visible in one view
- Orbital periods proportional to real periods but scaled so Earth = 12 seconds
- Saturn gets a ring (thin torus), Earth gets a moon
- Each planet: subtle axial rotation, hover shows a label with name + one fun fact
- Starfield background (2000 points), soft sun glow (sprite, additive blending)
- OrbitControls: damped, min distance outside the sun, max distance keeps Neptune in frame
- Click a planet to smoothly tween the camera to follow it; Escape returns to overview
No build step, no external assets beyond the CDN.`,
    artifact_url: "https://example.com/solar-threejs",
    tags: ["threejs", "one-shot", "game"],
    views: 4102,
  },
  {
    author: "shipfast",
    title: "What's the best prompt structure for getting Python scripts with proper error handling?",
    body: `Every generated Python script I get is happy-path only: no retries, bare excepts, crashes on the first weird input. I've been experimenting with a checklist-style prompt suffix that forces defensive code, pasted below.

It works decently, but it makes the model over-engineer tiny scripts. A 10-line CSV filter comes back as 150 lines with custom exception classes.

How do you calibrate the amount of defensiveness to the size of the task?`,
    prompt: `Write the Python script described above, then apply this hardening pass before showing me anything:
- Every file/network/subprocess operation wrapped with specific exception types (never bare except)
- Retries with exponential backoff (3 attempts) on network calls only
- Input validation at every public function boundary with actionable error messages ("expected a CSV with columns a,b,c; got columns x,y")
- Exit codes: 0 success, 1 user error, 2 environment error, plus a --verbose flag that enables debug logging
- If the script takes arguments, use argparse with examples in the epilog
- End with a self-check: list each failure mode you handled and each one you consciously did NOT handle and why
Keep the core logic readable; hardening must not triple the line count.`,
    artifact_url: null,
    tags: ["python", "one-shot"],
    views: 987,
  },
  {
    author: "promptsmith",
    title: "Prompt that turns any CSV into an interactive explorable chart page",
    body: `Drop a CSV in, get a self-contained exploration UI out. The prompt below produces a page that infers column types, picks sensible defaults, and lets you switch dimensions.

I use it weekly for one-off data questions. The type-inference instructions matter more than the charting instructions.`,
    prompt: `I will paste a CSV. Build a single-file HTML page that visualizes it with d3 (CDN). The page must:
1. Parse the CSV from an embedded <script type="text/csv"> block (embed my data verbatim)
2. Infer each column's type: numeric, categorical (<=20 uniques), date (try ISO then common formats), or text. Show the inferred schema in a collapsible panel.
3. Default view: if there's a date column, line chart of the first numeric over time; else bar chart of first numeric grouped by first categorical
4. Controls: dropdowns for X, Y, group-by, and aggregation (sum/mean/median/count) that redraw instantly
5. Hover tooltips with exact values, axis labels with units guessed from the header names
6. A "table" tab showing the raw rows, sortable by clicking headers
Handle up to 50k rows without freezing (aggregate before drawing).`,
    artifact_url: "https://example.com/csv-explorer",
    tags: ["data-viz", "one-shot"],
    views: 1544,
  },
  {
    author: "vibecoder",
    title: "System prompt for a customer support agent that knows when to escalate",
    body: `We shipped a support agent and the biggest problem wasn't wrong answers, it was confident wrong answers on questions it had no business answering. This system prompt made escalation behavior reliable.

The three-bucket triage at the top is the core idea. Everything downstream keys off which bucket the message lands in.`,
    prompt: `You are a support agent for {COMPANY}. Before answering ANY message, silently classify it into exactly one bucket:
A) ANSWERABLE: the answer exists verbatim in the provided docs context
B) ACTIONABLE: requires an account action (refund, plan change, data export)
C) ESCALATE: legal threats, security reports, medical/safety issues, requests to speak to a human, anything involving money over $200, or anything not covered by A/B

Rules per bucket:
- A: answer in under 120 words, quote the relevant doc line, link the doc
- B: confirm the specific action and its irreversible consequences, then emit the action as JSON {"action": ..., "params": ...} and nothing else
- C: respond with empathy in 2 sentences max, then emit {"escalate": true, "reason": ..., "urgency": "low|high"}. NEVER attempt a substantive answer in bucket C.
If docs contradict the user's claim about their account, trust the account data, say so gently, and cite it. Never invent policy. If you are less than 90% sure of the bucket, choose C.`,
    artifact_url: null,
    tags: ["agents", "claude"],
    views: 2230,
  },
];

const ANSWERS = [
  {
    q: 0,
    author: "lena-builds",
    body: `The generic-testimonial problem is that you're letting the model invent people. Pin the personas instead. I append this block to your prompt and the testimonials come out specific and believable:

Add three testimonials, each from a named persona with a job title and a concrete metric ("cut onboarding from 3 days to 4 hours"). One should mention a hesitation they had before buying. No exclamation marks.`,
    prompt: `Add a testimonials section: 3 cards. Each testimonial must (a) name a persona with role and company type, (b) cite one concrete before/after metric, (c) include one mild hesitation overcome ("I expected setup to be painful, but..."). Ban: "game changer", "10x", exclamation marks, and any sentence that could apply to a different product unchanged.`,
    accepted: true,
  },
  {
    q: 0,
    author: "shipfast",
    body: `One addition that helped me: ask for the pricing tier features to be *differentiated by verb*, not by adjective. "Unlimited projects" vs "Priority support" reads like every SaaS page ever. Forcing verbs ("Export to PDF", "Invite 10 teammates") makes the tiers feel real.`,
    prompt: null,
    accepted: false,
  },
  {
    q: 1,
    author: "onepromptwonder",
    body: `For sound without external assets, use the WebAudio API and synthesize everything. Append this to your prompt and you get satisfying blips with zero files:

It generates an oscillator-based sound module. The "duck the music on death" detail is what makes it feel intentional rather than tacked on.`,
    prompt: `Add sound using ONLY the WebAudio API (no audio files): eat = short square-wave blip rising in pitch with combo, death = descending sawtooth sweep + noise burst, subtle bass pulse on the beat of the game speed. Include a mute toggle (M key) persisted to localStorage. Duck all other sound 12dB for 400ms on death.`,
    accepted: true,
  },
  {
    q: 3,
    author: "promptsmith",
    body: `The hallucinated-function problem: add a verification step that forces the agent to quote the code it's referencing. If it must paste the exact lines, it can't cite functions that don't exist. Step 5 becomes: "quote the exact lines (with line numbers) for every finding; findings without a verbatim quote are invalid."`,
    prompt: null,
    accepted: true,
  },
  {
    q: 5,
    author: "agentwrangler",
    body: `Calibration trick: make the hardening budget explicit and proportional. I use a one-line addition: "Hardening budget: at most 40% of the core logic's line count for scripts under 50 lines, at most 100% for larger ones." The model actually respects numeric budgets far better than vibes like "keep it reasonable".`,
    prompt: null,
    accepted: false,
  },
];

const COMMENTS = [
  { q: 0, author: "vibecoder", body: "The 8px spacing grid instruction is doing so much work here. Stolen, thanks." },
  { q: 1, author: "lena-builds", body: "Confirmed this works on the first try. The CRT overlay is a nice touch." },
  { q: 3, author: "shipfast", body: "Ran this on our repo for a week. Two real catches, zero nitpicks. Believer now." },
  { q: 4, author: "promptsmith", body: "The logarithmic compromise phrasing is genius. Been fighting scale for weeks." },
];

async function main() {
  console.log("Creating users...");
  const userIds = {};
  for (const u of USERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    if (error) {
      // Maybe exists; look up
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users.find((x) => x.email === u.email);
      if (!existing) throw new Error(`create user ${u.username}: ${error.message}`);
      userIds[u.username] = existing.id;
    } else {
      userIds[u.username] = data.user.id;
    }
  }
  console.log(`  ${Object.keys(userIds).length} users ready`);

  console.log("Creating tags...");
  const tagIds = {};
  for (const [name, description] of TAGS) {
    const { data: existing } = await admin.from("tags").select("id").eq("name", name).maybeSingle();
    if (existing) {
      tagIds[name] = existing.id;
      await admin.from("tags").update({ description }).eq("id", existing.id);
    } else {
      const { data, error } = await admin.from("tags").insert({ name, description }).select("id").single();
      if (error) throw new Error(`tag ${name}: ${error.message}`);
      tagIds[name] = data.id;
    }
  }
  console.log(`  ${Object.keys(tagIds).length} tags ready`);

  // Idempotency: skip if questions already seeded
  const { count } = await admin.from("questions").select("id", { count: "exact", head: true });
  if (count > 0) {
    console.log(`Questions already exist (${count}), skipping question seed. Run scripts/reset.mjs first to reseed.`);
    return;
  }

  // Natural timestamps: spread questions over the last ~5 weeks, newest last in list.
  const now = Date.now();
  const HOUR = 3600 * 1000;
  const daysAgo = [34, 29, 23, 18, 12, 8, 5, 2];
  const questionTimes = QUESTIONS.map((_, i) => {
    const base = now - (daysAgo[i] ?? 1) * 24 * HOUR;
    // jitter by a few hours so times don't look synthetic
    return new Date(base + Math.floor(Math.random() * 9 - 4) * HOUR).toISOString();
  });

  console.log("Creating questions...");
  const questionIds = [];
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const { data, error } = await admin
      .from("questions")
      .insert({
        author_id: userIds[q.author],
        title: q.title,
        body: q.body,
        prompt: q.prompt,
        artifact_url: q.artifact_url,
        view_count: q.views,
        created_at: questionTimes[i],
        updated_at: questionTimes[i],
      })
      .select("id")
      .single();
    if (error) throw new Error(`question "${q.title}": ${error.message}`);
    questionIds.push(data.id);
    const tagRows = q.tags.map((t) => ({ question_id: data.id, tag_id: tagIds[t] }));
    const { error: te } = await admin.from("question_tags").insert(tagRows);
    if (te) throw new Error(`tags for q${data.id}: ${te.message}`);
  }
  console.log(`  ${questionIds.length} questions created`);

  console.log("Creating answers...");
  const answerIds = [];
  for (const a of ANSWERS) {
    // answers land 3h to 2d after their question
    const qTime = new Date(questionTimes[a.q]).getTime();
    const aTime = new Date(qTime + (3 + Math.floor(Math.random() * 45)) * HOUR).toISOString();
    const { data, error } = await admin
      .from("answers")
      .insert({
        question_id: questionIds[a.q],
        author_id: userIds[a.author],
        body: a.body,
        prompt: a.prompt,
        created_at: aTime,
        updated_at: aTime,
      })
      .select("id")
      .single();
    if (error) throw new Error(`answer: ${error.message}`);
    answerIds.push({ id: data.id, ...a });
  }
  console.log(`  ${answerIds.length} answers created`);

  console.log("Accepting answers...");
  for (const a of answerIds) {
    if (a.accepted) {
      await admin.from("answers").update({ is_accepted: true }).eq("id", a.id);
      await admin.from("questions").update({ accepted_answer_id: a.id }).eq("id", questionIds[a.q]);
    }
  }

  console.log("Creating comments...");
  for (const c of COMMENTS) {
    const { error } = await admin.from("comments").insert({
      post_type: "question",
      post_id: questionIds[c.q],
      author_id: userIds[c.author],
      body: c.body,
    });
    if (error) throw new Error(`comment: ${error.message}`);
  }

  console.log("Casting votes...");
  // Distribute votes across questions and answers from various users so scores
  // vary naturally. A small fraction are downvotes, like a real community.
  const voteSpecs = [];
  const usernames = Object.keys(userIds);
  // net-ish upvote targets per question (index-aligned with QUESTIONS)
  const questionVotes = [14, 31, 8, 22, 27, 6, 11, 17];
  for (let qi = 0; qi < questionIds.length; qi++) {
    const target = Math.min(questionVotes[qi] ?? 6, usernames.length - 1);
    let cast = 0;
    for (let v = 0; v < usernames.length && cast < target + 2; v++) {
      const voter = usernames[v];
      if (userIds[voter] === userIds[QUESTIONS[qi].author]) continue;
      // ~1 in 9 votes is a downvote for authenticity
      const vote_type = cast >= target ? -1 : 1;
      voteSpecs.push({ user_id: userIds[voter], post_type: "question", post_id: questionIds[qi], vote_type });
      cast++;
    }
  }
  for (const a of answerIds) {
    const n = Math.min(a.accepted ? 9 : 4, usernames.length - 1);
    let cast = 0;
    for (let v = 0; v < usernames.length && cast < n; v++) {
      const voter = usernames[v];
      if (userIds[voter] === userIds[a.author]) continue;
      voteSpecs.push({ user_id: userIds[voter], post_type: "answer", post_id: a.id, vote_type: 1 });
      cast++;
    }
  }
  for (const spec of voteSpecs) {
    const { error } = await admin.from("votes").insert(spec);
    if (error && !error.message.includes("duplicate")) console.warn(`  vote warn: ${error.message}`);
  }
  console.log(`  ${voteSpecs.length} votes cast`);

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error("SEED FAILED:", e.message);
  process.exit(1);
});
