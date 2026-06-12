<div align="center">

<img src="public/logo.png" alt="Hermes Synth" width="80" />

# Hermes Synth

### Open-source AI agent platform.

Build, deploy, and manage autonomous AI agents from your browser.  
Multi-model chat · Code editor · Terminal · Tasks · Cron · x402 Privacy

[![Live Demo](https://img.shields.io/badge/LIVE-hermessynth.org-0033ff?style=for-the-badge)](https://hermessynth.org)
[![Stars](https://img.shields.io/github/stars/hermesSynth/hermes-synth?style=for-the-badge&color=0033ff)](https://github.com/hermesSynth/hermes-synth/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![Solana](https://img.shields.io/badge/Solana-Network-9945FF?style=for-the-badge&logo=solana&logoColor=white)](https://solana.com)

[**Try it now →**](https://hermessynth.org) · [Docs](https://hermessynth.org/docs) · [Roadmap](https://hermessynth.org/roadmap) · [X](https://x.com/HermesSynth)

<a href="https://orynth.dev/projects/hermes-synth" target="_blank" rel="noopener">
  <img src="https://orynth.dev/api/badge/hermes-synth?theme=light&style=default" alt="Featured on Orynth" width="260" height="80" />
</a>

</div>

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-Model Chat** | Venice AI, OpenAI (GPT-4o), Anthropic (Claude), Groq — 12+ models, switch mid-chat |
| **Agent Builder** | Custom agents with names, system prompts, model selection, persistent memory |
| **Code Editor** | Write & run JS, Python, Ruby, Go, Rust, Java, C/C++, Bash |
| **AI Terminal** | Real code execution (30+ languages) + AI-powered commands |
| **Command Center** | 14+ system commands with live database stats |
| **Autonomous Tasks** | Describe a goal → AI breaks it into steps → auto-executes |
| **Cron Jobs** | Schedule recurring AI tasks (5 min to daily) |
| **Browser** | Scrape URLs, extract text & links, AI summarization |
| **Wallet Connect** | OKX, MetaMask, Coinbase, WalletConnect, Rainbow |
| **Analytics** | Usage dashboard — API calls, token usage, model breakdown |
| **Auth** | Google OAuth · GitHub OAuth · Email/Password + verification |
| **Profiles** | Photo upload, display name, bio |
| **Plugins** | Toggle extensions on/off per user |

---

## Quick Start

### Hosted (free)

**[→ hermessynth.org](https://hermessynth.org)** — no setup needed.

### Self-host on Cloudflare

```bash
git clone https://github.com/hermesSynth/hermes-synth.git
cd hermes-synth
npm install

# Create D1 database
npx wrangler d1 create hermes-synth-db
npx wrangler d1 execute hermes-synth-db --remote --file=schema.sql

# Deploy
npx wrangler pages deploy public --project-name=hermes-synth
```

### Local development

```bash
npm install
npx wrangler pages dev public
# → http://localhost:8788
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML/CSS/JS · JetBrains Mono · Clean dark theme |
| **Backend** | Cloudflare Pages Functions (serverless) |
| **Database** | Cloudflare D1 (SQLite at the edge) |
| **AI** | Venice AI · OpenAI · Anthropic · Groq — 12+ models |
| **Auth** | JWT + bcrypt · Google OAuth · GitHub OAuth |
| **Blockchain** | Solana · Wallet connect |
| **Email** | Resend |

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Browser    │────▶│  Cloudflare Pages │────▶│  Venice AI  │
│  (Frontend)  │◀────│   (Functions)     │◀────│  (4 models) │
└──────────────┘     └────────┬─────────┘     └─────────────┘
                              │
                     ┌────────▼─────────┐
                     │  Cloudflare D1   │
                     │  (12+ tables)    │
                     └──────────────────┘
```

---

## Environment Variables

Set in Cloudflare Pages → Settings → Environment Variables:

| Variable | Required | Description |
|----------|:--------:|-------------|
| `JWT_SECRET` | Yes | Secret for signing auth tokens |
| `VENICE_API_KEY` | Yes | Venice AI API key ([venice.ai](https://venice.ai)) |
| `RESEND_API_KEY` | No | Email verification ([resend.com](https://resend.com)) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth |

---

## Project Structure

```
hermes-synth/
├── functions/              # Serverless API
│   ├── _middleware.js      # JWT auth + CORS
│   ├── auth/               # Login, register, OAuth
│   ├── api/                # All API endpoints
│   │   ├── chat.js         # AI chat (multi-model)
│   │   ├── agents/         # Agent CRUD + chat
│   │   ├── tasks.js        # Autonomous tasks
│   │   ├── skills/         # Skills CRUD + run
│   │   ├── terminal.js     # AI terminal
│   │   ├── command.js      # Command center
│   │   ├── privacy/        # x402 Privacy (shielded payments)
│   │   ├── cron/           # Cron jobs
│   │   ├── browser/        # Web scraping
│   │   ├── wallet.js       # Credits & transactions
│   │   └── admin/          # Admin APIs
│   └── lib/auth.js         # JWT helpers
├── public/                 # Static frontend (26 pages)
├── schema.sql              # D1 database schema
├── wrangler.toml           # Cloudflare config
└── package.json
```

---

## Roadmap

- [x] Platform launch (hermessynth.org)
- [x] Multi-model support (Venice, OpenAI, Anthropic, Groq)
- [x] Real code execution terminal (30+ languages via Wandbox)
- [x] x402 Privacy — shielded USDC transactions on Solana
- [x] Chat sessions with markdown, streaming, search, pin, export
- [ ] Token launch on Solana — coming soon
- [ ] Agent marketplace
- [ ] Team collaboration & workspaces
- [ ] Webhook integrations (Discord, Telegram, Slack)
- [ ] Multi-chain expansion

[**Full Roadmap →**](https://hermessynth.org/roadmap)

---

## Token

**$SYNTH** — Contract Address (Solana)

```
6dyndsK8sKVv8NvdaxkQyVMecXu7esNa7yoVKgFJeory
```

> ⚠ Always verify the contract address. Token on Solana.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[MIT](LICENSE) — Hermes Synth © 2026

<div align="center">

**Built by [Hermes Synth](https://github.com/hermesSynth)**

[Website](https://hermessynth.org) · [Docs](https://hermessynth.org/docs) · [X (Twitter)](https://x.com/HermesSynth) · [Issues](https://github.com/hermesSynth/hermes-synth/issues)

</div>
