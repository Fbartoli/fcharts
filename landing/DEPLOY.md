# Deploying the site + waitlist (Cloudflare Pages + D1)

The marketing site is static (landing + playground + the sample ACR); the only dynamic piece is
`POST /api/waitlist`, a Cloudflare Pages Function that writes signups to D1 (SQLite). No server to
run, scales to zero, and you own the data (export anytime). All of this is in the repo — the steps
below are the one-time account setup only you can do.

## What's in the repo

| Path | What |
|---|---|
| `pnpm build:site` | Builds the static site → `dist-site/` (index, playground, and the ACR via publicDir). |
| `functions/api/waitlist.ts` | The Pages Function. Validates + upserts into D1; drops honeypot bots. |
| `migrations/0001_waitlist.sql` | The `waitlist` table. |
| `wrangler.toml` | Pages + D1 binding (`env.DB`). Paste your `database_id` here. |
| `landing/index.html` / `main.ts` | The form (email + consent + honeypot) posting to `/api/waitlist`. |

## One-time setup

```sh
npm i -g wrangler          # or use the repo devDep: npx wrangler ...
wrangler login

# 1. Create the database, then paste the printed database_id into wrangler.toml
wrangler d1 create sightline-waitlist

# 2. Create the table (add --remote to also apply it to the deployed DB)
wrangler d1 execute sightline-waitlist --local  --file=./migrations/0001_waitlist.sql
wrangler d1 execute sightline-waitlist --remote --file=./migrations/0001_waitlist.sql
```

## Run it locally (real function + local D1)

```sh
pnpm preview:site          # build:site, then `wrangler pages dev dist-site` with the D1 binding
# open the printed URL, submit the form, then read the rows back:
wrangler d1 execute sightline-waitlist --local --command "SELECT * FROM waitlist;"
```

## Deploy

**Easiest — git integration (no local wrangler for deploys):** in the Cloudflare dashboard create a
Pages project from this repo with build command `pnpm build:site` and output dir `dist-site`, then
bind D1 (variable name `DB` → the `sightline-waitlist` database) under Settings → Functions.

**Or from the CLI:**
```sh
pnpm build:site
wrangler pages deploy dist-site
```

## Read / export the list

```sh
wrangler d1 execute sightline-waitlist --remote --command "SELECT email, created_at, source FROM waitlist ORDER BY created_at DESC;"
wrangler d1 export  sightline-waitlist --remote --output waitlist.sql   # full backup
```

## Notes

- **Spam:** a hidden honeypot field + server-side validation; Cloudflare's edge adds free rate
  limiting. Add a Turnstile challenge later if bots get through.
- **Privacy/consent:** the form requires an explicit consent checkbox and stores only email +
  timestamp + source — keep that promise (you're selling accessibility compliance; practice it).
- **Notifications:** D1 has no built-in "email me on signup". Either poll the table, or add a second
  line in the function to forward via an email API (Resend/Postmark) or a queue.
