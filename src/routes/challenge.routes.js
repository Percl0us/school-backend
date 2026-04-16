import express from "express";
import { prisma } from "../lib/prisma.js";
import { upload } from "../middlewares/upload.middleware.js"; // ensure this exports uploadChallenge or default

const router = express.Router();

const parseChallengePayload = (body) => {
  const title = String(body.title || "").trim();
  const question = String(body.question || "").trim();
  const answerHint = String(body.answerHint || "").trim();
  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);

  if (!title || !question || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("Title, question, start date, and end date are required");
  }

  if (endDate <= startDate) {
    throw new Error("End date must be after start date");
  }

  return {
    title,
    question,
    answerHint: answerHint || null,
    allowImage: body.allowImage === "true" || body.allowImage === true,
    startDate,
    endDate,
  };
};

// ========== Student Facing ==========

// Get today's active challenge
router.get("/today", async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    );

    const challenge = await prisma.dailyChallenge.findFirst({
      where: {
        isActive: true,
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
      orderBy: { startDate: "desc" },
    });
    if (!challenge)
      return res.status(200).json({ message: "No active challenge today" });
    res.json(challenge);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit an answer (text + optional image)
router.post("/submit", upload.single("image"), async (req, res) => {
  try {
    const { challengeId, studentName, answerText } = req.body;
    if (!challengeId || !studentName || !answerText) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if already submitted today for this challenge
    const existing = await prisma.submission.findFirst({
      where: { challengeId, studentName },
    });
    if (existing) {
      return res
        .status(400)
        .json({ error: "You have already submitted for this challenge" });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.path; // Cloudinary URL
    }

    const submission = await prisma.submission.create({
      data: {
        challengeId,
        studentName,
        answerText,
        imageUrl,
        status: "PENDING",
      },
    });
    res.json({ message: "Submission received, pending review", submission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get leaderboard for today's challenge (approved submissions ordered by time)
router.get("/leaderboard/today", async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    );

    const challenge = await prisma.dailyChallenge.findFirst({
      where: {
        isActive: true,
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
    });
    if (!challenge) return res.json([]);

    const submissions = await prisma.submission.findMany({
      where: {
        challengeId: challenge.id,
        status: "APPROVED",
      },
      orderBy: { reviewedAt: "asc" },
      select: {
        studentName: true,
        createdAt: true,
        pointsAwarded: true,
        rank: true,
      },
    });
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== Admin Routes (protected) ==========

// Create a new challenge
// In challenge.routes.js
router.post(
  "/admin/challenges",
  upload.single("challengeImage"),
  async (req, res) => {
    try {
      const payload = parseChallengePayload(req.body);
      const challenge = await prisma.dailyChallenge.create({
        data: {
          ...payload,
          imageUrl: req.file?.path || null,
        },
      });
      res.json(challenge);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.put(
  "/admin/challenges/:challengeId",
  upload.single("challengeImage"),
  async (req, res) => {
    try {
      const existingChallenge = await prisma.dailyChallenge.findUnique({
        where: { id: req.params.challengeId },
      });

      if (!existingChallenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const payload = parseChallengePayload(req.body);
      const removeImage =
        req.body.removeImage === "true" || req.body.removeImage === true;

      const challenge = await prisma.dailyChallenge.update({
        where: { id: req.params.challengeId },
        data: {
          ...payload,
          imageUrl: removeImage
            ? null
            : req.file?.path || existingChallenge.imageUrl,
        },
      });

      res.json(challenge);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.delete("/admin/challenges/:challengeId", async (req, res) => {
  try {
    const existingChallenge = await prisma.dailyChallenge.findUnique({
      where: { id: req.params.challengeId },
      select: { id: true, title: true },
    });

    if (!existingChallenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.submission.deleteMany({
        where: { challengeId: req.params.challengeId },
      });

      await tx.dailyChallenge.delete({
        where: { id: req.params.challengeId },
      });
    });

    res.json({
      success: true,
      message: `Challenge "${existingChallenge.title}" deleted successfully`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all challenges (admin)
router.get("/admin/challenges", async (req, res) => {
  try {
    const challenges = await prisma.dailyChallenge.findMany({
      orderBy: { startDate: "desc" },
    });
    res.json(challenges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending submissions for a challenge
router.get("/admin/challenges/:challengeId/submissions", async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: {
        challengeId: req.params.challengeId,
        status: "PENDING",
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve / reject submission with rank & points
router.put("/admin/submissions/:submissionId", async (req, res) => {
  try {
    const { status, pointsAwarded, rank } = req.body;
    const submission = await prisma.submission.update({
      where: { id: req.params.submissionId },
      data: {
        status,
        pointsAwarded: pointsAwarded || 0,
        rank: rank || null,
        reviewedAt: new Date(),
        reviewedBy: "admin", // You can pass actual admin id from session
      },
    });
    res.json(submission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
