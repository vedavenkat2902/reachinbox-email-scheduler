import { prisma } from "../lib/prisma";

export async function createScheduledEmail(data: {
  campaignId: string;
  recipient: string;
  senderEmail: string;
  scheduledAt: Date;
}) {
  return prisma.scheduledEmail.create({
    data: {
      campaignId: data.campaignId,
      recipient: data.recipient.trim(),
      senderEmail: data.senderEmail.trim(),
      scheduledAt: data.scheduledAt,
      status: "SCHEDULED",
    },
  });
}

export async function updateScheduledEmailJobId(
  emailId: string,
  jobId: string
) {
  return prisma.scheduledEmail.update({
    where: {
      id: emailId,
    },
    data: {
      jobId,
    },
  });
}

export async function getScheduledEmailsByCampaign(
  campaignId: string
) {
  return prisma.scheduledEmail.findMany({
    where: {
      campaignId,
    },
    orderBy: {
      scheduledAt: "asc",
    },
  });
}