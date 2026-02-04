import { prisma } from "../lib/prisma.js";
import { generateReceiptPDF } from "../services/receipt.service.js";
import jwt from "jsonwebtoken";

export const getReceipt = async (req, res) => {
  try {
    // ✅ IMPORTANT: disable CSP for ALL code paths
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Content-Security-Policy");
    res.removeHeader("X-WebKit-CSP");

    const { paymentId } = req.params;
    const { admissionNo, dob } = req.query;

    // 1️⃣ Fetch payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.status !== "CONFIRMED") {
      return res.status(404).json({ error: "Receipt not available" });
    }

    /* =========================
       ADMIN ACCESS CHECK
    ========================= */

    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        jwt.verify(token, process.env.JWT_SECRET);

        // ✅ Admin verified
        await generateReceiptPDF(paymentId, res);
        return;
      } catch {
        // fall through to parent check
      }
    }

    /* =========================
       PARENT ACCESS CHECK
    ========================= */

    if (!admissionNo || !dob) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (admissionNo !== payment.admissionNo) {
      return res.status(403).json({ error: "Access denied" });
    }

    const student = await prisma.student.findUnique({
      where: { admissionNo },
    });

    if (!student) {
      return res.status(403).json({ error: "Access denied" });
    }

    const dobMatch =
      new Date(student.dob).toISOString().slice(0, 10) ===
      new Date(dob).toISOString().slice(0, 10);

    if (!dobMatch) {
      return res.status(403).json({ error: "Access denied" });
    }

    // ✅ Parent verified
    await generateReceiptPDF(paymentId, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};
