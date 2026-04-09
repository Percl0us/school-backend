import { prisma } from "../lib/prisma.js";

export const getNoticesService = async () => {
  const notices = await prisma.notice.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      date: "desc", // better than createdAt for notices
    },
  });

  return notices;
};