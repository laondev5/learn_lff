function normalizeUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value)
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  } catch {
    return false
  }
}

function toHttpsUrl(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value
  }

  return `https://${value}`
}

export function getAppUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeUrl(toHttpsUrl(value)))

  const preferredUrl = candidates.find((value) => {
    if (process.env.NODE_ENV !== "production") {
      return true
    }

    return !isLocalhostUrl(value)
  })

  return preferredUrl ?? "http://localhost:3000"
}
