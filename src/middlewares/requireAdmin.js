import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader)
      return res.status(401).json({ error: "Unauthorized" });

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId },
    });

    if (!admin || !admin.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.admin = admin;   // 👈 attach full admin
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
};