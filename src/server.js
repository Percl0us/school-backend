import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

import adminRoutes from "./routes/admin.routes.js";
import studentRoutes from "./routes/student.routes.js";
import paymeneRoutes from './routes/payment.route.js'
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "not connected" });
  }
});
app.use("/payments", paymeneRoutes);

// after app.use(express.json())
app.use("/admin", adminRoutes);

// after app.use(express.json())
app.use("/student", studentRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
