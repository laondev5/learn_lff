"use client"

async function requestUpload(body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch("/api/video/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "Video upload failed")
  return data
}

/** Best-effort cleanup after saving a completed upload fails. Reference checks run server-side. */
export async function discardR2Upload(url: string): Promise<void> {
  await requestUpload({ action: "discard", url }).catch(() => undefined)
}

export async function uploadVideo(file: File, onProgress: (percent: number) => void, signal?: AbortSignal): Promise<string> {
  if (!file.size || file.size > 500 * 1024 * 1024) throw new Error("Video must be between 1 byte and 500 MB")
  let token: string | undefined
  try {
    onProgress(0)
    const session = await requestUpload({ action: "start", size: file.size, contentType: file.type || "video/mp4" }, signal)
    token = session.token
    const partSize: number = session.partSize
    for (let offset = 0, part = 1; offset < file.size; offset += partSize, part++) {
      signal?.throwIfAborted()
      const { url } = await requestUpload({ action: "part", token, part }, signal)
      const chunk = file.slice(offset, Math.min(file.size, offset + partSize))
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const abort = () => xhr.abort()
        const finish = (error?: Error) => {
          signal?.removeEventListener("abort", abort)
          if (error) reject(error); else resolve()
        }
        xhr.open("PUT", url)
        xhr.timeout = 15 * 60 * 1000
        xhr.upload.onprogress = event => {
          if (event.lengthComputable) onProgress(Math.min(99, Math.round((offset + event.loaded) / file.size * 100)))
        }
        xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300 ? undefined : new Error(`Video part upload failed (${xhr.status})`))
        xhr.onerror = () => finish(new Error("Video upload failed. Check your connection and bucket CORS settings."))
        xhr.ontimeout = () => finish(new Error("Video upload timed out"))
        xhr.onabort = () => finish(new Error("Video upload cancelled"))
        signal?.addEventListener("abort", abort, { once: true })
        if (signal?.aborted) { finish(new Error("Video upload cancelled")); return }
        xhr.send(chunk)
      })
    }
    // Completion is idempotent; retry once if its response was lost.
    let completed
    try { completed = await requestUpload({ action: "complete", token }, signal) }
    catch { signal?.throwIfAborted(); completed = await requestUpload({ action: "complete", token }, signal) }
    if (typeof completed.videoUrl !== "string") throw new Error("Upload completed without a video URL")
    onProgress(100)
    return completed.videoUrl
  } catch (error) {
    if (token) await requestUpload({ action: "abort", token }).catch(() => undefined)
    throw error
  }
}
