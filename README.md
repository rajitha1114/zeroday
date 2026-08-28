# z3roday.com

Static site plus a small Worker that handles the enquiry form. Deploys to Cloudflare Workers.

```
public/
  index.html      the site
  privacy.html    served at /privacy
  _headers        security headers (CSP, HSTS, frame-ancestors)
  _redirects      /privacy.html → /privacy
  robots.txt
  sitemap.xml
src/
  index.js        Worker: POST /api/enquiry, everything else from ./public
wrangler.toml
```

## Deploy

```bash
npm install
npx wrangler login
npx wrangler deploy
```

That gives you `z3roday.<your-subdomain>.workers.dev`. Check it works, then attach the real domain.

## Attach z3roday.com

1. Cloudflare dashboard → **Add a site** → `z3roday.com`, and repoint the nameservers at your registrar. Wait for it to go active.
2. Uncomment the two `[[routes]]` blocks in `wrangler.toml`.
3. `npx wrangler deploy`

Cloudflare issues the TLS certificate automatically. Leave **Always Use HTTPS** on.

## Make the enquiry form work

The form posts to `/api/enquiry`, which forwards to your inbox via [Resend](https://resend.com) (free tier is 3,000 emails/month — far more than you'll need).

1. Sign up at Resend and verify `z3roday.com` as a sending domain. This means adding SPF, DKIM and DMARC records — do it properly, because **your entire go-to-market is cold outreach and your domain reputation is the whole ball game.**
2. Create an API key.
3. Store it as a secret, never in the repo:

```bash
npx wrangler secret put RESEND_API_KEY
```

4. Set up `hello@z3roday.com` as a real mailbox (Cloudflare Email Routing forwards it free to any address you already read), then `npx wrangler deploy`.

Until the key is set, the form returns an error and the visitor sees a fallback message with the mailto address — nothing is silently swallowed. Submissions are also logged, so run `npx wrangler tail` if you want to watch them arrive.

## Push this to GitHub

From inside this folder:

```bash
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin git@github.com:rajitha1114/zeroday.git
git push -u origin main
```

If you use HTTPS rather than SSH, swap the remote for
`https://github.com/rajitha1114/zeroday.git` and authenticate with a personal
access token when prompted.

`.gitignore` already excludes `node_modules/`, `.wrangler/` and `.dev.vars`.
**Never commit `.dev.vars` or the Resend key** — it's the one file that would
matter if the repo were ever made public.

## Deploy automatically on every push

`.github/workflows/deploy.yml` deploys to Cloudflare whenever you push to
`main`. Two repository secrets are needed — GitHub → Settings → Secrets and
variables → Actions:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → right-hand sidebar |

Scope the API token to only the account and zone you need. A token with broader
rights than the job requires is exactly the finding you'd write up for a client.

The `RESEND_API_KEY` is a Worker secret, not a GitHub secret — set it once with
`npx wrangler secret put RESEND_API_KEY` and it persists across deploys.


## Local development

```bash
cp .dev.vars.example .dev.vars   # add your real key
npx wrangler dev
```

## Editing the site

`public/index.html` is one self-contained file — markup, CSS and JS. No build step. Edit, then `npx wrangler deploy`.

Things you'll want to change before launch:

| What | Where |
|---|---|
| Phone number placeholder `+94 00 000 0000` | `index.html`, contact block |
| Fee figures (3,500 / 6,500 / 14,000 / 3,000) | `#deadline`, `#work` |
| The 25-document guarantee wording | `.guarantee` in `#work` |
| The countdown target date | `src`/inline script, `new Date(2026, 11, 10)` — note JS months are zero-indexed, so `11` is December |

## Two things to check before you launch

**The Essential Eight card** in `#frameworks` describes the current ASD maturity model. Confirm the wording against cyber.gov.au before it goes live.

**The APP 1.7 scoping language** in `#deadline` and the FAQ should be read by a privacy lawyer. You disclaim legal advice on the page, which is right, but the description of the obligation itself needs to be accurate.

## Notes on the security headers

`_headers` sets a strict CSP. It allows `'unsafe-inline'` for scripts and styles because the site is deliberately a single file with no build step. If you later move the JS to an external file, tighten `script-src` to `'self'` — a security consultancy running a loose CSP is the kind of thing a prospect will check.
