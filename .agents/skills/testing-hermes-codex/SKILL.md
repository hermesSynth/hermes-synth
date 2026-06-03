---
name: testing-hermes-synth
description: Test the Hermes Synth platform end-to-end. Use when verifying UI, auth, chat, settings, analytics, or agent changes.
---

# Testing Hermes Synth

## Production URL
- https://hermessynth.org (Cloudflare Pages + Functions)

## Devin Secrets Needed
- None required — test credentials are public test accounts

## Test Account
- Email: `tezaa06@gmail.com`
- Password: `hermes123`
- Tier: `free_trial`

## Architecture
- **Frontend**: Static HTML files in `public/` deployed via Cloudflare Pages
- **Backend**: Cloudflare Pages Functions in `functions/` (auth, API, chat)
- **Auth**: JWT cookies + Google OAuth + GitHub OAuth
- **Data**: Cloudflare KV for user data
- **Deploy**: `npx wrangler pages deploy public/ --project-name hermes-synth --branch main`
- **Branch**: Must be lowercase `main` (NOT `Main`) — uppercase causes preview-only deploys

## Deployment Notes
- After merging PRs, changes are NOT auto-deployed. Must run wrangler deploy manually.
- The wrangler deploy uses the `public/` directory (not `auth-service/static/`).
- All authenticated pages redirect to /login (302) when accessed without auth cookie — curl will return empty body.
- To verify deployment, check public/unauthenticated pages or login via browser.

## Routes to Test

### Public Routes
| Route | Expected |
|-------|----------|
| `GET /` (unauthenticated) | Landing page with "Hermes Synth" branding |
| `GET /login` | Login form with Google/GitHub OAuth + email/password |
| `GET /register` | Registration form |

### Protected Routes (require auth, redirect to /login without cookie)
| Route | Expected |
|-------|----------|
| `GET /chat` | Chat interface with multi-model selector (12 models, 4 providers) |
| `GET /agents` | Agent management with Quick Templates + agent cards with Chat/Edit buttons |
| `GET /settings` | YOUR ACCOUNT section, AGENT CONFIGURATION, PREFERENCES, AI PREFERENCES |
| `GET /analytics` | YOUR ACTIVITY personal stats + PLATFORM OVERVIEW admin analytics |
| `GET /profile` | Profile page — edit name, photo, bio, change password |
| `GET /api-keys` | API keys management for Venice, OpenAI, Anthropic, Groq |
| `GET /editor` | Code editor |
| `GET /terminal` | Terminal interface |
| `GET /welcome` | Deploy agent wizard (onboarding) |
| `GET /upgrade` | Free Trial vs Premium pricing |

## Key Features to Verify

### Bottom Navigation
- All authenticated pages should have bottom nav: Chat, Agents, Editor, Terminal, Settings, Profile
- NO "MCP" link — it was replaced with "Profile"
- Profile link uses person icon (head + shoulders SVG)

### Settings — AI Preferences
- Section labeled "AI PREFERENCES" below PREFERENCES
- Default Model picker (prompt dialog with 12 models across Venice/OpenAI/Anthropic/Groq)
- Temperature (0.0-1.0, default 0.7)
- Max Tokens (256-8192, default 2048)
- Streaming toggle (default ON)
- All values persist to localStorage (`hc_default_model`, `hc_temperature`, `hc_max_tokens`, `hc_streaming`)
- Default model auto-loads in /chat page model dropdown

### Settings — Your Account
- Section labeled "YOUR ACCOUNT" at top of settings
- Links to: Profile, API Keys, Analytics

### Analytics — Personal Stats
- "YOUR ACTIVITY" section at top with 4 stat cards: Your Agents, Days Active, Plan, Joined
- Your Agents list with model info
- "PLATFORM OVERVIEW" section below with API calls, tokens, active users, messages

### Agent Cards
- Each agent card has blue "Chat" button and outlined "Edit" button
- Clicking Chat opens detail view with model info displayed
- Detail view shows chat history and message input

### Responsive
- responsive.css has mobile-specific rules for settings, agent cards, profile, analytics
- Touch feedback: `transform: scale(0.98)` on active states

## Testing Steps

1. **Verify site accessible**: `curl -s -o /dev/null -w "%{http_code}" https://hermessynth.org/` → expect 200
2. **Test auth redirect**: `curl -s -o /dev/null -w "%{http_code}" https://hermessynth.org/chat` → expect 302
3. **Login via browser**: Navigate to /login, enter test credentials (tezaa06@gmail.com / hermes123)
4. **Verify bottom nav**: Check for Profile link (not MCP) on /chat page
5. **Test Settings AI Preferences**: Navigate to /settings, scroll to AI PREFERENCES, change default model
6. **Verify Settings→Chat integration**: After changing model in settings, go to /chat and verify dropdown
7. **Test Analytics**: Navigate to /analytics, verify YOUR ACTIVITY section with personal stats
8. **Test Agent cards**: Navigate to /agents, verify Chat/Edit buttons, click Chat to open detail
9. **Verify responsive CSS**: Check responsive.css is deployed with mobile rules

## Terminal Code Execution Testing

### How It Works
- Terminal uses **Wandbox API** (https://wandbox.org/api/compile.json) for real code execution
- Backend maps language names to specific Wandbox compiler identifiers in `functions/api/terminal.js`
- Commands prefixed with language name execute code: `python print(2+2)`, `node console.log("hi")`
- Multi-statement languages (Go, Rust, Java) use `run <lang> <code>` syntax

### Terminal Test Commands
| Language | Command | Expected |
|----------|---------|----------|
| Python | `python print(2+2)` | 4 |
| JavaScript | `node console.log("test")` | test |
| Rust | `run rust fn main() { println!("hello"); }` | hello |
| Go | `run go package main; import "fmt"; func main() { fmt.Println("hi") }` | hi |
| Bash | `bash echo $((7*6))` | 42 |
| TypeScript | `ts console.log("ts")` | ts |

### Terminal Testing Tips
- **Single-line only**: Terminal input is a single-line text field — use semicolons for multi-statement languages (Go needs `package main; import "fmt"; func main() {...}`)
- **Compilation time**: Compiled languages (Rust, Go, Java) take 5-15 seconds to respond; interpreted (Python, JS, Bash) respond in 2-5 seconds
- **Wandbox compiler names matter**: If a language fails, check that the compiler name in `compilerMap` (functions/api/terminal.js) is valid. Query `https://wandbox.org/api/list.json` to verify available compilers.
- **Non-JSON errors**: Wandbox returns plain text errors for invalid compiler names. The error handling wraps JSON.parse in try-catch to avoid crashes.
- **Built-in commands** (`help`, `languages`, `ls`, `whoami`, etc.) are handled client-side and don't call Wandbox

### Terminal Deployment
- After changing `functions/api/terminal.js`, deploy with: `npx wrangler pages deploy public/ --project-name hermes-synth --branch main`
- Verify fix is live by testing the specific language that was broken

## Common Issues
- Chat may return fallback response when no AI provider API key is configured — expected behavior
- Model picker uses browser `prompt()` dialog — may timeout in automated tools, handle accordingly
- After wrangler deploy, CDN cache might serve old content briefly — wait or force refresh
- Google/GitHub OAuth requires correct redirect URIs in respective consoles for hermessynth.org domain
- If email verification is enabled, Resend domain must be verified for hermessynth.org
- Venice API requires credits/balance — "Insufficient USD or Diem balance" error means user needs to top up at https://venice.ai/settings/api

## Branding Checklist
- All pages should say "Hermes Synth" (not "Hermes Codex" or "Hermes Agent")
- Login page: h1 = "Hermes Synth", form = "Sign in"
- Chat header: "CHAT", title "Talk to Synth."
- Settings header: "SETTINGS"
- Landing page: "Hermes Synth" with anime girl logo
