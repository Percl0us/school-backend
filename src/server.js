import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import { prisma } from "./lib/prisma.js";

import adminRoutes from "./routes/admin.routes.js";
import studentRoutes from "./routes/student.routes.js";
import paymentRoutes from "./routes/payment.route.js";
import homeroutes from "./routes/home.routes.js";
import challengeRoutes from "./routes/challenge.routes.js"; // 👈 ADD THIS

dotenv.config();

const app = express();

/* Middlewares */
app.use(cors());
app.use(express.json());
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

/* Health check */
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "not connected" });
  }
});

/* Routes */
app.use("/admin", adminRoutes);
app.use("/student", studentRoutes);
app.use("/payments", paymentRoutes);
app.use("/home", homeroutes);
app.use("/challenge", challengeRoutes); // 👈 ADD THIS

/* Ignore favicon */
app.get("/favicon.ico", (_, res) => res.status(204).end());

/* Server */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});