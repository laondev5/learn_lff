// Prints a dashboard-ready policy by default. --apply merges it with existing rules.
import { GetBucketCorsCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { r2Config, safeFailure } from "./r2-common.mjs";
try {
  const origins = [...new Set([process.env.NEXT_PUBLIC_APP_URL, process.env.NEXTAUTH_URL, "http://localhost:3000", ...process.argv.filter(a => a.startsWith("--origin=")).map(a => a.slice(9))].filter(Boolean).map(value => new URL(value).origin))];
  const rule = { ID: "lff-video-browser", AllowedOrigins: origins, AllowedMethods: ["GET", "HEAD", "PUT"], AllowedHeaders: ["Content-Type", "Range", "If-Range"], ExposeHeaders: ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"], MaxAgeSeconds: 3600 };
  console.log(JSON.stringify([rule], null, 2));
  if (process.argv.includes("--apply")) {
    const { client, bucket } = r2Config();
    let existing = [];
    try { existing = (await client.send(new GetBucketCorsCommand({ Bucket: bucket }))).CORSRules || []; }
    catch (error) { if (error.name !== "NoSuchCORSConfiguration") throw error; }
    await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: [...existing.filter(r => r.ID !== rule.ID), rule] } }));
    console.log("CORS updated.");
  } else console.log("Dry run. Paste the policy in R2 > bucket > Settings > CORS policy, or use --apply with bucket-admin credentials. Keep public access disabled.");
} catch (error) { safeFailure("CORS configuration failed; dashboard action may be required", error); }
