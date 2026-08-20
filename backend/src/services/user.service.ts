import { prisma } from "../lib/prisma";

export async function findUserByGoogleId(googleId: string) {
  return prisma.user.findUnique({
    where: {
      googleId,
    },
  });
}

export async function createUser(data: {
  googleId: string;
  name: string;
  email: string;
  avatarUrl?: string;
}) {
  return prisma.user.create({
    data,
  });
}