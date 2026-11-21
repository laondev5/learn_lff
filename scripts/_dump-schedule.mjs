import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
console.log("schedules", JSON.stringify(await db.collection("cohortschedules").find({}).toArray(), null, 1).slice(0,1500));
console.log("apps", (await db.collection("cohortapplications").find({}).project({student:1,status:1,cohort:1,schedule:1}).toArray()).length);
console.log(JSON.stringify(await db.collection("cohortapplications").find({}).project({student:1,status:1,cohort:1}).limit(10).toArray(),null,1));
console.log("progress", JSON.stringify(await db.collection("studentprogresses").find({}).project({student:1,course:1}).toArray(),null,1));
console.log("course", JSON.stringify(await db.collection("courses").find({}).project({title:1,teacher:1,isPaid:1,price:1}).toArray(),null,1));
await mongoose.disconnect();
