// Read-only: list one object, HEAD it when present, and inspect CORS.
import { ListObjectsV2Command, HeadObjectCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { r2Config, safeFailure } from "./r2-common.mjs";
try {
  const { client, bucket } = r2Config();
  const objects = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
  console.log("R2 object listing: OK");
  if (objects.Contents?.[0]?.Key) {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objects.Contents[0].Key }));
    console.log("R2 object metadata read: OK");
  } else console.log("Bucket is empty; object HEAD check skipped.");
  try {
    const cors = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log("CORS rules:", JSON.stringify(cors.CORSRules || [], null, 2));
  } catch (error) {
    console.log(`CORS inspection unavailable (${error.name}). Use the dashboard if object-only credentials cannot manage CORS.`);
  }
} catch (error) { safeFailure("R2 read-only check failed", error); }
