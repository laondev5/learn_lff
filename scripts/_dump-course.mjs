import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DETAIL = process.argv.includes("--detail");

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  console.log("collections:", (await db.listCollections().toArray()).map((c) => c.name).join(", "));
  const courses = await db.collection("courses").find({}).toArray();
  for (const c of courses) {
    console.log("COURSE", c._id.toString(), "|", c.title, "| published:", c.isPublished);
  }
  const modules = await db.collection("modules").find({}).sort({ order: 1 }).toArray();
  const lessons = await db.collection("lessons").find({}).sort({ order: 1 }).toArray();
  console.log("modules:", modules.length, "lessons:", lessons.length);
  const byModule = new Map();
  for (const l of lessons) {
    const k = l.module?.toString();
    if (!byModule.has(k)) byModule.set(k, []);
    byModule.get(k).push(l);
  }
  for (const m of modules) {
    console.log(`MODULE ${m.order} ${m._id} | ${m.title} | published:${m.isPublished}`);
    for (const l of byModule.get(m._id.toString()) ?? []) {
      const cues = l.videoCues ?? [];
      const qs = cues.reduce((n, c) => n + (c.questions?.length ?? 0), 0);
      console.log(
        `  L${l.order} ${l._id} | ${l.title} | type:${l.lessonType} | published:${l.isPublished} | dur:${l.duration ?? "-"} | cues:${cues.length} q:${qs} | url:${l.videoUrl ? l.videoUrl.slice(0, 60) : "NONE"}`
      );
      if (DETAIL) {
        for (const c of cues) {
          console.log(`     cue ${c.timestamp}s "${c.title}" -> ${c.questions.map((q) => q.text).join(" || ").slice(0, 300)}`);
        }
      }
    }
  }
  const users = await db.collection("users").find({}).project({ email: 1, role: 1, isActive: 1 }).toArray();
  console.log("users:", users.length);
  console.log(users.map((u) => `${u.role}:${u.email}:active=${u.isActive}`).join("\n"));
} catch (e) {
  console.error("DB ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
