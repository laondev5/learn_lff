/**
 * Module deadline sweep — Cloudflare Worker on a Cron Trigger.
 *
 * Replaces .github/workflows/cron-progress.yml. Every 15 minutes it POSTs to the
 * app's /api/cron/progress endpoint, which scores every module window that has
 * already closed, records absences once, and emails accountability partners.
 *
 * The endpoint is idempotent, so retries and overlapping runs are safe.
 */

export interface Env {
  /** Base URL of the deployed app, e.g. https://lms.example.org (no trailing slash). */
  APP_URL: string
  /** Must match the app's CRON_SECRET env var. */
  CRON_SECRET: string
}

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 15_000
const REQUEST_TIMEOUT_MS = 300_000

// Minimal structural types so this file type-checks under the app's tsconfig,
// which does not load @cloudflare/workers-types. They match the runtime shapes
// Cloudflare passes to a scheduled handler.
type CronEvent = { scheduledTime: number; cron: string }
type WorkerContext = { waitUntil(promise: Promise<unknown>): void }

type SweepOutcome = {
  ok: boolean
  status: number
  body: string
  attempts: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function configError(env: Env): string | null {
  if (!env.APP_URL) return "APP_URL secret is not set"
  if (!env.CRON_SECRET) return "CRON_SECRET secret is not set"
  if (!/^https?:\/\//.test(env.APP_URL)) return "APP_URL must start with http:// or https://"
  return null
}

async function callSweep(env: Env): Promise<SweepOutcome> {
  const base = env.APP_URL.replace(/\/+$/, "")
  const url = `${base}/api/cron/progress`
  let last: SweepOutcome = { ok: false, status: 0, body: "", attempts: 0 }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CRON_SECRET}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      })
      const body = await res.text()
      last = { ok: res.ok, status: res.status, body, attempts: attempt }

      // 4xx (other than 429) will not succeed on retry — bad secret or bad route.
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        return last
      }
    } catch (error) {
      last = {
        ok: false,
        status: 0,
        body: error instanceof Error ? error.message : String(error),
        attempts: attempt,
      }
    } finally {
      clearTimeout(timer)
    }

    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS)
  }

  return last
}

const worker = {
  /** Cron Trigger entry point. */
  async scheduled(_event: CronEvent, env: Env, ctx: WorkerContext): Promise<void> {
    const problem = configError(env)
    if (problem) {
      console.error(`[module-sweep] ${problem}`)
      throw new Error(problem)
    }

    ctx.waitUntil(
      (async () => {
        const result = await callSweep(env)
        if (result.ok) {
          console.log(`[module-sweep] ok status=${result.status} attempts=${result.attempts} body=${result.body}`)
        } else {
          console.error(`[module-sweep] failed status=${result.status} attempts=${result.attempts} body=${result.body}`)
          throw new Error(`Sweep failed with status ${result.status}`)
        }
      })()
    )
  },

  /**
   * Manual trigger for debugging:
   *   curl -X POST https://lff-module-sweep.<subdomain>.workers.dev \
   *     -H "Authorization: Bearer $CRON_SECRET"
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST" && request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 })
    }

    const problem = configError(env)
    if (problem) {
      return Response.json({ error: problem }, { status: 503 })
    }

    const header = request.headers.get("authorization") ?? ""
    if (header !== `Bearer ${env.CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await callSweep(env)
    return Response.json(
      {
        ok: result.ok,
        status: result.status,
        attempts: result.attempts,
        body: result.body,
      },
      { status: result.ok ? 200 : 502 }
    )
  },
}

export default worker
