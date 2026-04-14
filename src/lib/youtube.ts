import "server-only"
import { google } from "googleapis"
import { Readable } from "stream"

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  )
  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  })
  return oauth2Client
}

export async function uploadVideoToYouTube(
  fileBuffer: Buffer,
  title: string,
  description: string,
  mimeType: string
): Promise<{ videoId: string; url: string }> {
  const auth = getOAuth2Client()
  const youtube = google.youtube({ version: "v3", auth })

  const stream = Readable.from(fileBuffer)

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        categoryId: "27", // Education
      },
      status: {
        privacyStatus: "unlisted", // unlisted so only people with link can view
      },
    },
    media: {
      mimeType,
      body: stream,
    },
  })

  const videoId = response.data.id!
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  }
}
