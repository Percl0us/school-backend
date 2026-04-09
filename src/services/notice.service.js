import { prisma } from "../lib/prisma.js";

export const getAllNoticesService = async () => {
  return await prisma.notice.findMany({
    orderBy: { createdAt: "desc" },
  });
};

export const createNoticeService = async ({ title, date, type }) => {
  return await prisma.notice.create({
    data: {
      title,
      date: new Date(date),
      type,
      isActive: true,
    },
  });
};

export const toggleNoticeService = async (id) => {
  const notice = await prisma.notice.findUnique({
    where: { id },
  });

  if (!notice) throw new Error("Notice not found");

  return await prisma.notice.update({
    where: { id },
    data: {
      isActive: !notice.isActive,
    },
  });
};