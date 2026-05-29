const COMPRESS_THRESHOLD = 100 * 1024 * 1024 // 100 MB
const TARGET_MB = 90 // target output — leaves ~10 MB buffer below Cloudinary's 100 MB limit

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve(video.duration)
    }
    video.onerror = () => reject(new Error("Could not read video metadata"))
    video.src = URL.createObjectURL(file)
  })
}

/**
 * Returns the file unchanged if under 100 MB.
 * Otherwise compresses it to ~90 MB using FFmpeg.wasm with a bitrate calculated
 * to fit within the target, preserving the highest quality possible at that size.
 */
export async function compressVideoIfNeeded(
  file: File,
  onProgress: (pct: number) => void
): Promise<File> {
  if (file.size < COMPRESS_THRESHOLD) return file

  const { FFmpeg } = await import("@ffmpeg/ffmpeg")
  const { fetchFile, toBlobURL } = await import("@ffmpeg/util")

  const ffmpeg = new FFmpeg()
  ffmpeg.on("progress", ({ progress }) => {
    onProgress(Math.min(99, Math.round(progress * 100)))
  })

  // Single-threaded core — no SharedArrayBuffer needed for the WASM itself,
  // but the JS wrapper still needs it; teacher routes have COEP/COOP set.
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  })

  const duration = await getVideoDuration(file)

  // Calculate video bitrate that yields exactly TARGET_MB total output
  const targetBytes = TARGET_MB * 1024 * 1024
  const audioBps = 128 * 1024 // 128 kbps audio
  const videoBps = Math.max(
    300_000, // floor at 300 kbps to keep video watchable
    Math.floor((targetBytes * 8 - audioBps * duration) / duration)
  )

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4"
  const inputName = `input.${ext}`
  const outputName = "output.mp4"

  await ffmpeg.writeFile(inputName, await fetchFile(file))
  await ffmpeg.exec([
    "-i", inputName,
    "-c:v", "libx264",
    "-b:v", String(videoBps),
    "-preset", "veryfast", // faster encode, minimal quality penalty vs slower presets
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    outputName,
  ])

  const data = await ffmpeg.readFile(outputName)
  ffmpeg.terminate()

  // new Uint8Array(typedArray) copies the data into a fresh ArrayBuffer,
  // satisfying TypeScript's strict BufferSource / File constructor types.
  const bytes = new Uint8Array(data as Uint8Array)
  return new File(
    [bytes],
    file.name.replace(/\.[^/.]+$/, "_compressed.mp4"),
    { type: "video/mp4" }
  )
}
