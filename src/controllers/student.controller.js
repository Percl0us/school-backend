import { prisma } from "../lib/prisma.js";

export const studentLogin = async (req, res) => {
  try {
    const { admissionNo, dob, academicYear } = req.body;

    if (!admissionNo || !dob || !academicYear) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    // 1️⃣ Verify student
    const student = await prisma.student.findUnique({
      where: { admissionNo },
    });

    if (!student) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const dobMatch =
      new Date(student.dob).toISOString().slice(0, 10) ===
      new Date(dob).toISOString().slice(0, 10);

    if (!dobMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 2️⃣ Fetch academic record
    const academic = await prisma.studentAcademic.findUnique({
      where: {
        admissionNo_academicYear: {
          admissionNo,
          academicYear,
        },
      },
    });

    if (!academic) {
      return res
        .status(404)
        .json({ error: "Academic record not found" });
    }

    // 3️⃣ Fetch fee account
    const feeAccount = await prisma.studentFeeAccount.findUnique({
      where: {
        admissionNo_academicYear: {
          admissionNo,
          academicYear,
        },
      },
    });

    if (!feeAccount) {
      return res
        .status(404)
        .json({ error: "Fee account not found" });
    }

    // 4️⃣ Active discounts
    const discounts = await prisma.discount.findMany({
      where: {
        admissionNo,
        academicYear,
        active: true,
      },
    });

    // 5️⃣ Payments (confirmed + pending only)
    const payments = await prisma.payment.findMany({
      where: {
        admissionNo,
        academicYear,
        status: {
          in: ["CONFIRMED", "PENDING"],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 6️⃣ Response (single source of truth)
    res.json({
      student: {
        admissionNo: student.admissionNo,
        name: student.name,
        dob: student.dob,
      },
      academic,
      feeAccount,
      discounts,
      payments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};
