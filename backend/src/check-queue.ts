import { emailQueue } from "./lib/queue";

async function checkQueue() {
  const jobs = await emailQueue.getJobs([
    "waiting",
    "delayed",
    "active",
    "failed",
    "completed",
  ]);

  const rows = [];

  for (const job of jobs) {
    rows.push({
      id: job.id,
      state: await job.getState(),
      scheduledEmailId: job.data?.scheduledEmailId,
      delay: job.opts?.delay,
    });
  }

  console.table(rows);

  await emailQueue.close();
}

checkQueue().catch((error) => {
  console.error(error);
  process.exit(1);
});