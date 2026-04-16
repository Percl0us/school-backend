import { prisma } from "../lib/prisma.js";
import jwt from "jsonwebtoken";

export const studentLogin = async (req, res) => {
  try {
    const { admissionNo, dob, academicYear } = req.body;

    // Validate required fields
    if (!admissionNo || !dob || !academicYear) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    // 1️⃣ Verify student exists
    const student = await prisma.student.findUnique({
      where: { admissionNo },
    });

    if (!student) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if student is active
    if (student.active === false) {
      return res.status(401).json({ error: "Account is disabled" });
    }

    // 2️⃣ Compare DOB (timezone-safe)
    // Stored as UTC Date, convert to YYYY-MM-DD string
    const storedDate = student.dob.toISOString().slice(0, 10);
    // Incoming dob should be YYYY-MM-DD from frontend
    const inputDate = dob;

    if (storedDate !== inputDate) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 3️⃣ Fetch academic record
    const academic = await prisma.studentAcademic.findUnique({
      where: {
        admissionNo_academicYear: {
          admissionNo,
          academicYear,
        },
      },
    });

    if (!academic) {
      return res.status(404).json({ error: "Academic record not found" });
    }

    // 4️⃣ Fetch fee account
    const feeAccount = await prisma.studentFeeAccount.findUnique({
      where: {
        admissionNo_academicYear: {
          admissionNo,
          academicYear,
        },
      },
    });

    if (!feeAccount) {
      return res.status(404).json({ error: "Fee account not found" });
    }

    // 5️⃣ Active discounts
    const discounts = await prisma.discount.findMany({
      where: {
        admissionNo,
        academicYear,
        active: true,
      },
    });

    // 6️⃣ Payments (confirmed + pending only)
    const payments = await prisma.payment.findMany({
      where: {
        admissionNo,
        academicYear,
        status: {
          in: ["CONFIRMED", "PAYMENT_SUBMITTED", "REJECTED"],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 7️⃣ Generate JWT token for authentication
    const token = jwt.sign(
      {
        admissionNo: student.admissionNo,
        academicYear,
        role: "student",
        name: student.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 8️⃣ Send response
    res.json({
      token,
      student: {
        admissionNo: student.admissionNo,
        name: student.name,
        dob: student.dob,
        fatherName: student.fatherName,
        motherName: student.motherName,
        profileImageUrl: student.profileImageUrl,
      },
      academic,
      feeAccount,
      discounts,
      payments,
    });
  } catch (err) {
    console.error("Student login error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};
