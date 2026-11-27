# Module deadline sweep (Cloudflare Cron)

Cloudflare Worker that replaces the old GitHub Actions workflow
(`.github/workflows/cron-progress.yml`). Every 15 minutes it POSTs to the app's
`/api/cron/progress` endpoint.

The endpoint scores every module whose 24-hour window has closed, records
absences once, and emails the student's accountability partner. It is
idempotent, so a late, retried or overlapping run is harmless.

## Why Cloudflare

GitHub Actions scheduled workflows are queued on shared runners and can be
delayed by many minutes at peak times; Cloudflare Cron Triggers fire within a
few seconds of the boundary. Neither is exact enough to matter here — the sweep
scores *every* window that has already closed — but Cloudflare is more
predictable and does not consume Actions minutes.

## One-time setup

```bash
cd cloudflare/module-sweep
npx wrangler login

# Same values the GitHub workflow used as repository secrets.
npx wrangler secret put APP_URL      # e.g. https://lms.example.org  (no trailing slash)
npx wrangler secret put CRON_SECRET  # must equal the app's CRON_SECRET env var

npx wrangler deploy
```

`wrangler deploy` registers the cron trigger from `wrangler.toml`
(`*/15 * * * *`). No other configuration is required.

## Verify

Trigger a run by hand:

```bash
curl -X POST "https://lff-module-sweep.<your-subdomain>.workers.dev" \
  -H "Authorization: Bearer $CRON_SECRET"
```

A healthy response looks like:

```json
{ "ok": true, "status": 200, "attempts": 1, "body": "{\"evaluated\":3,\"sent\":1,\"failed\":0}" }
```

Stream the scheduled logs:

```bash
npx wrangler tail
```

## Behaviour

| Concern | Handling |
| --- | --- |
| Transient failure | 3 attempts, 15s apart |
| Non-retryable 4xx | Returned immediately (bad secret / bad route) |
| Slow app | 5-minute per-attempt timeout via `AbortController` |
| Missing secrets | Fails loudly in logs rather than silently doing nothing |
| Manual trigger | `fetch` handler, same bearer token as the cron |

## Rotating the secret

Change `CRON_SECRET` in the app's environment first, then
`npx wrangler secret put CRON_SECRET`, then redeploy is not needed — the secret
is read at invocation time.
