import { prisma } from "../lib/prisma.js";

export const createAcademicSession = async (req, res) => {
  try {
    const { academicYear, startDate, endDate } = req.body;

    if (!academicYear || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await prisma.academicSession.findUnique({
      where: { academicYear },
    });

    if (existing) {
      return res.status(409).json({ error: "Academic session already exists" });
    }

    const session = await prisma.academicSession.create({
      data: {
        academicYear,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });

    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create academic session" });
  }
};

export const getAllAcademicSessions = async (req, res) => {
  try {
    const sessions = await prisma.academicSession.findMany({
      orderBy: { academicYear: "desc" },
    });

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch academic sessions" });
  }
};

export const getActiveAcademicSession = async (req, res) => {
  try {
    const session = await prisma.academicSession.findFirst({
      where: { isActive: true },
      orderBy: { academicYear: "desc" },
    });

    if (!session) {
      return res.status(404).json({ error: "No active academic session" });
    }

    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch active session" });
  }
};

export const updateAcademicSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { academicYear, startDate, endDate, isActive } = req.body;

    const session = await prisma.academicSession.update({
      where: { id },
      data: {
        ...(academicYear && { academicYear }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update academic session" });
  }
};

export const deleteAcademicSession = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.academicSession.delete({
      where: { id },
    });

    res.json({ message: "Academic session deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete academic session" });
  }
};
