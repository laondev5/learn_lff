/**
 * Restore course access for legacy students who enrolled before the cohort
 * admission gate was introduced, but who already have a successful payment and
 * an enrolment row. Idempotent. Does not change any access-control code.
 *
 *  - laondev42@gmail.com  -> accept existing PENDING application
 *  - ekohabraham5@gmail.com -> create an ACCEPTED application (none exists)
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const COURSE = "6ae7aefcb85ea3c5d860b351";
const targets = [
  { email: "laondev42@gmail.com", student: "6aff15cb512f54940399c0d9" },
  { email: "ekohabraham5@gmail.com", student: "6a198e71897ddd45c5723683" },
];

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const schedule = await db.collection("cohortschedules").findOne({ course: new mongoose.Types.ObjectId(COURSE) }, { sort: { startsAt: -1 } });
  if (!schedule) throw new Error("No cohort schedule for the Family Class course");

  for (const t of targets) {
    const studentId = new mongoose.Types.ObjectId(t.student);
    const paid = await db.collection("paymenttransactions").findOne({
      student: studentId, course: new mongoose.Types.ObjectId(COURSE), status: "success",
    });
    const enrolled = await db.collection("studentprogresses").findOne({
      student: studentId, course: new mongoose.Types.ObjectId(COURSE),
    });
    if (!paid || !enrolled) {
      console.log(`SKIP ${t.email}: missing payment or enrolment`);
      continue;
    }

    const existing = await db.collection("cohortapplications").findOne({ student: studentId, schedule: schedule._id });
    if (existing?.status === "accepted") {
      console.log(`OK ${t.email}: already accepted (${existing._id})`);
      continue;
    }

    if (existing) {
      await db.collection("cohortapplications").updateOne(
        { _id: existing._id },
        { $set: { status: "accepted", respondedAt: new Date(), acceptedAt: new Date(), updatedAt: new Date() } }
      );
      console.log(`ACCEPTED ${t.email}: pending application ${existing._id} -> accepted`);
    } else {
      const now = new Date();
      const doc = {
        student: studentId,
        course: new mongoose.Types.ObjectId(COURSE),
        schedule: schedule._id,
        cohort: schedule.cohort,
        status: "accepted",
        partnerName: "Legacy Enrolment (restored)",
        partnerEmail: "admin@learn.livingfaithfoundation.org",
        partnerPhone: "00000000000",
        partnerInformed: true,
        passwordSetupRequired: false,
        emailStatus: "sent",
        respondedAt: now,
        acceptedAt: now,
        tokenExpiresAt: new Date(now.getTime() + 24 * 3600_000),
        createdAt: now,
        updatedAt: now,
      };
      const res = await db.collection("cohortapplications").insertOne(doc);
      console.log(`CREATED ${t.email}: accepted application ${res.insertedId}`);
    }
  }
} catch (e) {
  console.error("ERR", e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
