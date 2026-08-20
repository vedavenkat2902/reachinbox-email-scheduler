import { prisma } from "./lib/prisma";
import { emailQueue } from "./lib/queue";

async function resetData() {
  console.log("Starting reset...");

  // Remove all scheduled emails
  const deletedEmails =
    await prisma.scheduledEmail.deleteMany({});

  console.log(
    `Deleted ${deletedEmails.count} scheduled emails`
  );

  // Remove all campaigns
  const deletedCampaigns =
    await prisma.campaign.deleteMany({});

  console.log(
    `Deleted ${deletedCampaigns.count} campaigns`
  );

  // Remove all BullMQ jobs, including delayed/retry jobs
  await emailQueue.obliterate({
    force: true,
  });

  console.log("Deleted all BullMQ jobs");

  await prisma.$disconnect();

  console.log("RESET COMPLETE");
}

resetData().catch(async (error) => {
  console.error("Reset failed:", error);

  await prisma.$disconnect();

  process.exit(1);
});