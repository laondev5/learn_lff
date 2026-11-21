/**
 * Create (or refresh) the three bot test accounts on the Family Class course and
 * give the bot student everything the access rules require: an accepted cohort
 * application on the current schedule, an enrolment row and a successful
 * payment for the paid course. Idempotent: safe to re-run.
 *
 * Credentials are generated here and written to .bot-test-accounts.json
 * (git-ignored) so no password ever appears in source or shell history.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcryptjs from "bcryptjs";
import mongoose from "mongoose";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const ACCOUNTS_FILE = path.join(process.cwd(), ".bot-test-accounts.json");
const PASSWORD = process.env.BOT_TEST_PASSWORD ?? `Bot${crypto.randomBytes(9).toString("base64url")}9!aA`;
const COURSE_TITLE = "Family Class";

const ACCOUNTS = [
  { key: "admin", name: "Bot Admin", email: "bot-admin@lff.test", role: "admin" },
  { key: "teacher", name: "Bot Teacher", email: "bot-teacher@lff.test", role: "teacher" },
  { key: "student", name: "Bot Student", email: "bot-student@lff.test", role: "student" },
];

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;

const course = await db.collection("courses").findOne({ title: COURSE_TITLE });
if (!course) throw new Error(`Course "${COURSE_TITLE}" not found`);

const schedule = await db.collection("cohortschedules").findOne({ course: course._id }, { sort: { startsAt: -1 } });
if (!schedule) throw new Error("No cohort schedule for the course");

const hashedPassword = await bcryptjs.hash(PASSWORD, 12);
const results = {};

for (const account of ACCOUNTS) {
  const now = new Date();
  await db.collection("users").updateOne(
    { email: account.email },
    {
      $set: {
        name: account.name,
        email: account.email,
        hashedPassword,
        role: account.role,
        isActive: true,
        mustChangePassword: false,
        updatedAt: now,
        ...(account.role === "student" ? { cohort: schedule.cohort } : {}),
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  const user = await db.collection("users").findOne({ email: account.email });
  results[account.key] = { id: user._id.toString(), email: account.email, role: account.role };
  console.log(`${account.role.padEnd(7)} ${account.email}  ${user._id}`);
}

const studentId = new mongoose.Types.ObjectId(results.student.id);
const courseId = course._id;
const now = new Date();

// Accepted application on the active schedule (this is what unlocks the modules).
await db.collection("cohortapplications").updateOne(
  { student: studentId, schedule: schedule._id },
  {
    $set: {
      student: studentId,
      course: courseId,
      schedule: schedule._id,
      cohort: schedule.cohort,
      status: "accepted",
      acceptedAt: now,
      respondedAt: now,
      partnerName: "Bot Accountability Partner",
      partnerEmail: "bot-partner@lff.test",
      partnerPhone: "00000000000",
      partnerInformed: true,
      passwordSetupRequired: false,
      emailStatus: "sent",
      tokenExpiresAt: new Date(now.getTime() + 86400000),
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true }
);

// Enrolment row required by /api/lessons/[id]/video and the module access rules.
await db.collection("studentprogresses").updateOne(
  { student: studentId, course: courseId },
  { $setOnInsert: { student: studentId, course: courseId, enrolledAt: now, viewedLessons: [], completedLessons: [], completedTests: [], completedModules: [], examPassed: false, certificateIssued: false, createdAt: now, updatedAt: now } },
  { upsert: true }
);

// The Family Class course is paid: record a successful payment so the student is entitled.
await db.collection("paymenttransactions").updateOne(
  { student: studentId, course: courseId, reference: "BOT-TEST-PAYMENT" },
  {
    $set: {
      student: studentId,
      course: courseId,
      amount: course.price ?? 10000,
      currency: "NGN",
      status: "success",
      reference: "BOT-TEST-PAYMENT",
      provider: "paystack",
      paidAt: now,
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true }
);

fs.writeFileSync(
  ACCOUNTS_FILE,
  JSON.stringify({ courseId: courseId.toString(), scheduleId: schedule._id.toString(), cohort: schedule.cohort, password: PASSWORD, accounts: results }, null, 2)
);
console.log(`\ncredentials written to ${ACCOUNTS_FILE}`);
await mongoose.disconnect();
