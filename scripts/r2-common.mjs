import nextEnv from "@next/env";
import { S3Client } from "@aws-sdk/client-s3";
nextEnv.loadEnvConfig(process.cwd());
export function r2Config() {
  const { R2_ACCOUNT_ID: account, R2_BUCKET_NAME: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
  if (!/^[a-f0-9]{32}$/.test(account || "") || !bucket || !accessKeyId || !secretAccessKey) throw new Error("Missing R2 configuration");
  const endpoint = `https://${account}.r2.cloudflarestorage.com`;
  return { bucket, endpoint, client: new S3Client({ region: "auto", endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey }, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" }) };
}
export function safeFailure(label, error) {
  console.error(`${label}: ${error?.name || "Error"} (HTTP ${error?.$metadata?.httpStatusCode || "unknown"}). Details withheld to protect credentials.`);
  process.exitCode = 1;
}

