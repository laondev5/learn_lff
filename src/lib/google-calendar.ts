import { randomBytes, createHash, timingSafeEqual } from "node:crypto"
import { google } from "googleapis"
import { connectDB } from "./mongoose"
import User from "@/models/User.model"
import { getAppUrl } from "@/lib/app-url"

export const GOOGLE_STATE_COOKIE = "lff_google_oauth_state"
export const GOOGLE_STATE_MAX_AGE_SECONDS = 600

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
]

function getGoogleRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || `${getAppUrl()}/api/auth/callback/google`
}

function createGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGoogleRedirectUri()
  )
}

export function createGoogleAuthUrl() {
  const oauth2Client = createGoogleOAuthClient()
  const state = randomBytes(24).toString("base64url")

  return {
    state,
    url: oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: CALENDAR_SCOPES,
      prompt: "consent", // Force consent to ensure we get a refresh token
      state,
    }),
  }
}

/**
 * The state nonce lives in an http-only cookie, so only this browser can pair a
 * redirect with the value Google echoes back. Without it, an attacker can trick a
 * signed-in teacher into linking the attacker's Google account to their profile.
 */
export function verifyGoogleAuthState(incoming: string | null, cookie: string | undefined) {
  if (!incoming || !cookie) return false

  const a = createHash("sha256").update(incoming).digest()
  const b = createHash("sha256").update(cookie).digest()

  return timingSafeEqual(a, b)
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = createGoogleOAuthClient()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

export async function getGoogleAuthClient(userId: string) {
  await connectDB()
  const user = await User.findById(userId)

  if (!user || !user.googleRefreshToken) {
    throw new Error("User not connected to Google Calendar")
  }

  const client = createGoogleOAuthClient()

  client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.googleTokenExpiry,
  })

  // Set up token refresh handling
  client.on("tokens", async (tokens) => {
    if (tokens.refresh_token) {
      user.googleRefreshToken = tokens.refresh_token
    }
    if (tokens.access_token) {
      user.googleAccessToken = tokens.access_token
    }
    if (tokens.expiry_date) {
      user.googleTokenExpiry = tokens.expiry_date
    }
    await user.save()
  })

  return client
}

export async function createCalendarEvent(
  userId: string,
  event: {
    title: string
    description: string
    startTime: string
    endTime: string
  }
) {
  const authClient = await getGoogleAuthClient(userId)
  const calendar = google.calendar({ version: "v3", auth: authClient })

  const response = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary: event.title,
      description: event.description,
      start: { dateTime: event.startTime },
      end: { dateTime: event.endTime },
      conferenceData: {
        createRequest: {
          requestId: `lff-lms-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  })

  const meetLink = response.data.hangoutLink
  const googleEventId = response.data.id

  if (!meetLink || !googleEventId) {
    throw new Error("Failed to generate Google Meet link")
  }

  return { meetLink, googleEventId }
}
