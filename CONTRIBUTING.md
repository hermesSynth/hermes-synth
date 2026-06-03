# Contributing to Hermes Synth

Thanks for your interest in Hermes Synth! Contributions — bug reports, fixes, features, and docs — are welcome.

## Ground Rules

- Be respectful — see [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
- For security issues, **do not** open a public issue — follow [`SECURITY.md`](SECURITY.md).
- For anything non-trivial, open an issue first so we can align before you build.

## Development Setup

Requirements: Node.js 18+, a [Cloudflare](https://cloudflare.com) account.

```bash
# Install dependencies
npm install

# Run locally with Wrangler
npx wrangler pages dev public

# Deploy to Cloudflare Pages
CLOUDFLARE_API_TOKEN=<token> npx wrangler pages deploy public --project-name=hermes-synth
```

## Project Layout

- `functions/` — Cloudflare Pages serverless functions (auth, API endpoints).
- `public/` — Static frontend (HTML, CSS, JS).
- `schema.sql` — D1 database schema.
- `docs/` — Screenshots and documentation.

## Pull Requests

1. Fork and create a branch from `Main`.
2. Keep changes focused; match the surrounding code style.
3. Describe what changed and why; link any related issue.
4. No secrets, credentials, or personal data in commits.
5. By contributing, you agree your contributions are licensed under the MIT License.
