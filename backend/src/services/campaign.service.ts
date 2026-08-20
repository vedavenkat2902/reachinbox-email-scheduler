import { prisma } from "../lib/prisma";

export async function createCampaign(data: {
  userId: string;
  subject: string;
  body: string;
  startTime: Date;
  delaySeconds: number;
  hourlyLimit: number;
}) {
  return prisma.campaign.create({
    data,
  });
}

export async function getCampaignsByUser(userId: string) {
  return prisma.campaign.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}