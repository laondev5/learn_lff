import "server-only"
import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in your .env file")
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: {
    conn: typeof mongoose | null
    promise: Promise<typeof mongoose> | null
  }
}

const cached = global._mongooseCache ?? { conn: null, promise: null }
global._mongooseCache = cached

export async function connectDB() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    })
  }

  try {
    cached.conn = await cached.promise
    return cached.conn
  } catch (error) {
    // Reset cached promise so subsequent calls can retry connection.
    cached.promise = null
    cached.conn = null
    throw error
  }
}
