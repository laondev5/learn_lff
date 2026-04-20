import { google } from "googleapis"
import { connectDB } from "./mongoose"
import User from "@/models/User.model"

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

export function getAuthUrl() {
  const scopes = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ]

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent", // Force consent to ensure we get a refresh token
  })
}

export async function getTokensFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

export async function getGoogleAuthClient(userId: string) {
  await connectDB()
  const user = await User.findById(userId)

  if (!user || !user.googleRefreshToken) {
    throw new Error("User not connected to Google Calendar")
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

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
