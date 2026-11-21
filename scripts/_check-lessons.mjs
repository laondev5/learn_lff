import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const map = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".local-video-map.json"), "utf8"));

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  const lessons = db.collection("lessons");
  const ids = Object.keys(map);
  const found = await lessons.find({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } }).project({ title: 1, videoUrl: 1, course: 1 }).toArray();
  console.log("mapped:", ids.length, "found in DB:", found.length);
  for (const l of found) {
    console.log(l._id.toString(), "|", (l.videoUrl ? "URL" : "NO-URL"), "|", l.title);
  }
  const missing = ids.filter((id) => !found.some((l) => l._id.toString() === id));
  if (missing.length) console.log("MISSING IDS:", missing.join(", "));
  const total = await lessons.countDocuments({});
  console.log("total lessons in DB:", total);
} catch (e) {
  console.error("DB ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
