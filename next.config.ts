import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "mongodb", "nodemailer", "bcryptjs", "cloudinary"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production"

    // Turbopack and React's dev-mode call stacks need eval(); production never does.
    const scriptSrc = [
      "script-src 'self' 'unsafe-inline' blob:",
      !isProd ? "'unsafe-eval'" : "",
      "https://www.youtube.com https://cdn.jsdelivr.net https://unpkg.com",
    ]
      .filter(Boolean)
      .join(" ")

    // Dev HMR uses a plain ws:// socket to this origin; production only ever needs
    // the encrypted Pusher socket.
    const connectSrc = [
      "connect-src 'self' blob: data:",
      "https://api.paystack.co https://api.cloudinary.com https://*.pusher.com wss://*.pusher.com",
      "https://unpkg.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com",
      !isProd ? "ws:" : "",
    ]
      .filter(Boolean)
      .join(" ")

    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Proctoring needs the microphone; nothing in the app uses camera, geolocation,
      // payments or USB from within these pages.
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          // 'unsafe-inline' is required by Next's own inline bootstrap scripts;
          // move to a middleware-generated nonce to tighten this further.
          scriptSrc,
          "worker-src 'self' blob: https://cdn.jsdelivr.net",
          "child-src 'self' blob:",
          connectSrc,
          "frame-src 'self' https://www.youtube.com",
          "img-src 'self' data: blob: https://*.cloudinary.com https://i.ytimg.com https://www.youtube.com",
          "media-src 'self' blob: data: https://*.cloudinary.com https://*.youtube.com",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join("; "),
      },
    ]

    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // FFmpeg.wasm needs SharedArrayBuffer, which requires these headers
        source: "/teacher/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
      {
        // Dashboard and API responses hold another user's data; keep them out of
        // the browser cache and out of the history back-button.
        source: "/(admin|teacher|student|api)/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ]
  },
};

export default nextConfig;
