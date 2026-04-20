import { checkStudentProgress } from "../src/lib/cron"

async function run() {
  try {
    await checkStudentProgress()
    process.exit(0)
  } catch (error) {
    console.error("Cron failed:", error)
    process.exit(1)
  }
}

run()
