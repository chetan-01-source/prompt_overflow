# Prompt Overflow

**Stack Overflow for AI prompts.** Ask, answer, vote, and remix prompts that build websites, apps, and cool ideas — with a built-in [MCP](https://modelcontextprotocol.io) server so AI agents can search and use the prompt library directly.

**Live:** [prompt-overflow.vercel.app](https://prompt-overflow.vercel.app)

## Features

- **Q&A for prompts** — post questions, share prompt answers, accept the best one
- **Voting** — upvote/downvote questions, answers, and comments
- **Tags** — browse and filter prompts by tag
- **Full-text search** — find prompts fast
- **Social layer** — comments with editing, @mentions, notifications, user profiles
- **Auth** — email/password, username login, and magic-link signup (Supabase Auth)
- **Built-in MCP server** — `/api/mcp` speaks Model Context Protocol over streamable HTTP, no separate process

## MCP Server

Any MCP-capable client (Claude Desktop, Cursor, etc.) can connect to the hosted endpoint:

```
https://prompt-overflow.vercel.app/api/mcp
```

Tools exposed:

| Tool | What it does |
| --- | --- |
| `list_prompts` | Browse prompts (newest / top-voted, paginated) |
| `search_prompts` | Full-text search across the prompt library |
| `get_question` | Fetch a question with all answers and comments |
| `get_prompts_by_tag` | Prompts filtered by tag |
| `list_tags` | All tags with counts |
| `discover_prompts` | Answer-aware discovery for a goal/task |
| `get_related_prompts` | Prompts related to a given question |
| `compose_prompts` | Combine multiple prompts into one |
| `list_prompt_templates` / `get_prompt_template` | Reusable prompt templates |

See [`/mcp-info`](https://prompt-overflow.vercel.app/mcp-info) on the site for client setup snippets.

## Tech Stack

- [Next.js 14](https://nextjs.org) (App Router, server components + server actions)
- [Supabase](https://supabase.com) — Postgres, Auth, Row Level Security
- TypeScript, Playwright (e2e), zero CSS frameworks (hand-rolled Stack-Overflow-style UI)

## Self-Hosting / Local Development

### 1. Clone and install

```bash
git clone https://github.com/sanjeev-one/prompt_overflow.git
cd prompt_overflow
npm install
```

### 2. Create a Supabase project

Create a free project at [supabase.com](https://supabase.com), then apply the schema:

```bash
# with the Supabase CLI linked to your project
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

(Or paste the SQL files from `supabase/migrations/` into the Supabase SQL editor, in order.)

### 3. Configure environment

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### 4. (Optional) Seed demo data

```bash
node scripts/seed.mjs
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Tests

```bash
npm run lint        # eslint
npm run test:e2e    # playwright (needs a running app + seeded Supabase)
```

## Deploying

One-click deploy on [Vercel](https://vercel.com): import the repo, set the three env vars from `.env.example`, done. The MCP server ships with the app at `/api/mcp`.

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Contributions come in via fork + pull request; maintainers review and merge.

## License

[MIT](LICENSE)
