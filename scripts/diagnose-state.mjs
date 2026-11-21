import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const out = [];
const say = (s) => { out.push(s); console.log(s); };

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  say("=== COLLECTIONS ===\n" + cols.map(c => c.name).sort().join(", "));

  // 1. Admin accounts
  say("\n=== ADMIN ACCOUNTS ===");
  const admins = await db.collection("users").find({ role: "admin" }).project({ email: 1, name: 1, isActive: 1, mustChangePassword: 1, password: 1 }).toArray();
  for (const a of admins) say(`${a.email} | active=${a.isActive} | mustChange=${a.mustChangePassword} | hasPwd=${!!a.password} | id=${a._id}`);

  // 2. Bot accounts
  say("\n=== BOT ACCOUNTS ===");
  const bots = await db.collection("users").find({ email: /bot/i }).project({ email: 1, role: 1, isActive: 1 }).toArray();
  for (const b of bots) say(`${b.email} | role=${b.role} | active=${b.isActive} | id=${b._id}`);
  if (!bots.length) say("(none)");

  // 3. Lessons videoUrl
  say("\n=== LESSON VIDEO URLS ===");
  const lessons = await db.collection("lessons").find({}).project({ title: 1, videoUrl: 1, youtubeVideoId: 1, module: 1, course: 1, lessonType: 1 }).toArray();
  say("lesson count: " + lessons.length);
  for (const l of lessons) {
    const v = l.videoUrl || "";
    const kind = v.includes("r2.cloudflarestorage.com") ? "R2" : v.includes("cloudinary") ? "CLOUDINARY" : v.includes("youtube") ? "YT" : v ? "OTHER" : "NONE";
    say(`${l._id} | ${kind} | mod=${String(l.module || "-")} | ${l.title} | ${v.slice(0, 110)}`);
  }

  // 4. Tests
  say("\n=== TESTS ===");
  const testCols = ["tests", "exams", "assessments", "coursequestions", "testsubmissions"];
  for (const c of testCols) {
    const count = await db.collection(c).countDocuments({}).catch(() => 0);
    say(`${c}: ${count}`);
  }
  const tests = await db.collection("tests").find({}).project({ title: 1, lesson: 1, module: 1, course: 1, isPublished: 1, questions: 1 }).toArray().catch(() => []);
  for (const t of tests) {
    const q = Array.isArray(t.questions) ? t.questions.length : 0;
    say(`TEST ${t._id} | pub=${t.isPublished} | q=${q} | lesson=${String(t.lesson || "-")} | mod=${String(t.module || "-")} | ${t.title}`);
  }

  // 5. Modules / courses
  say("\n=== MODULES & COURSES ===");
  const modules = await db.collection("modules").find({}).project({ title: 1, course: 1, order: 1 }).toArray();
  for (const m of modules) say(`MOD ${m._id} | course=${String(m.course || "-")} | order=${m.order} | ${m.title}`);
  const courses = await db.collection("courses").find({}).project({ title: 1, teacher: 1, isPublished: 1 }).toArray();
  for (const c of courses) say(`COURSE ${c._id} | teacher=${String(c.teacher || "-")} | pub=${c.isPublished} | ${c.title}`);
} catch (e) {
  say("DB ERROR: " + e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

fs.writeFileSync(path.join(process.cwd(), "scripts", "diagnose.log"), out.join("\n") + "\n");
