import { prisma } from "../lib/prisma.js";

export const getStudentFinanceService = async (admissionNo, academicYear) => {
  const student = await prisma.student.findUnique({
    where: { admissionNo },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  const feeAccount = await prisma.studentFeeAccount.findUnique({
    where: {
      admissionNo_academicYear: {
        admissionNo,
        academicYear,
      },
    },
  });

  if (!feeAccount) {
    throw new Error("Fee account not found");
  }

  const discounts = await prisma.discount.findMany({
    where: {
      admissionNo,
      academicYear,
    },
    orderBy: { appliedAt: "desc" },
  });

  const payments = await prisma.payment.findMany({
    where: {
      admissionNo,
      academicYear,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    student: {
      admissionNo: student.admissionNo,
      name: student.name,
    },
    feeAccount,
    discounts,
    payments,
  };
};
export const getGlobalFinanceService = async (academicYear) => {
  const accounts = await prisma.studentFeeAccount.findMany({
    where: { academicYear },
    include: {
      student: true,
    },
  });

  const payments = await prisma.payment.findMany({
    where: { academicYear },
  });

  const discounts = await prisma.discount.findMany({
    where: { academicYear },
  });

  return {
    accounts,
    payments,
    discounts,
  };
};
export const getAcademicYearsService = async () => {
  const years = await prisma.studentAcademic.findMany({
    distinct: ["academicYear"],
    select: { academicYear: true },
    orderBy: { academicYear: "desc" },
  });

  return years.map((y) => y.academicYear);
};
export const getPendingPaymentsService = async (academicYear) => {
  const payments = await prisma.payment.findMany({
    where: {
      academicYear,
      status: "PAYMENT_SUBMITTED",
    },
    include: {
      student: {
        select: {
          name: true,
          fatherName: true, // 👈 Added
          motherName: true, // 👈 Added
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const academics = await prisma.studentAcademic.findMany({
    where: {
      academicYear,
      admissionNo: {
        in: payments.map((p) => p.admissionNo),
      },
    },
  });

  const classMap = new Map();
  academics.forEach((a) => {
    classMap.set(a.admissionNo, a.class);
  });

  return payments.map((p) => ({
    paymentId: p.id,
    admissionNo: p.admissionNo,
    studentName: p.student.name,
    fatherName: p.student.fatherName, // 👈 Mapping to frontend
    motherName: p.student.motherName, // 👈 Mapping to frontend
    class: classMap.get(p.admissionNo) || "",
    amount: p.amount,
    monthsCovered: p.monthsCovered,
    utrNumber: p.utrNumber,
    screenshotUrl: p.screenshotUrl,
    createdAt: p.createdAt,
  }));
};
export const getFinanceOverviewService = async (academicYear) => {
  if (!academicYear) {
    throw new Error("Academic year required");
  }

  // 1️⃣ Get academic records
  const academics = await prisma.studentAcademic.findMany({
    where: { academicYear },
    include: {
      student: {
        select: {
          name: true,
          fatherName: true,
          motherName: true,
        },
      },
    },
  });

  const admissionNos = academics.map((a) => a.admissionNo);

  // 2️⃣ Get fee accounts
  const feeAccounts = await prisma.studentFeeAccount.findMany({
    where: {
      academicYear,
      admissionNo: { in: admissionNos },
    },
  });

  const feeMap = new Map();
  feeAccounts.forEach((f) => {
    feeMap.set(f.admissionNo, f);
  });

  // 3️⃣ Active discounts
  const discounts = await prisma.discount.findMany({
    where: {
      academicYear,
      active: true,
      admissionNo: { in: admissionNos },
    },
  });

  const discountMap = new Map();
  discounts.forEach((d) => {
    discountMap.set(d.admissionNo, d.amount);
  });

  // 4️⃣ Pending payments count
  const pendingPayments = await prisma.payment.findMany({
    where: {
      academicYear,
      status: "PAYMENT_SUBMITTED",
      admissionNo: { in: admissionNos },
    },
  });

  const pendingCountMap = new Map();
  pendingPayments.forEach((p) => {
    pendingCountMap.set(
      p.admissionNo,
      (pendingCountMap.get(p.admissionNo) || 0) + 1,
    );
  });
  // 4.5️⃣ Get all payments for this academic year
  const allPayments = await prisma.payment.findMany({
    where: {
      academicYear,
      admissionNo: { in: admissionNos },
    },
    orderBy: { createdAt: "desc" },
  });

  const paymentMap = new Map();

  allPayments.forEach((p) => {
    if (!paymentMap.has(p.admissionNo)) {
      paymentMap.set(p.admissionNo, []);
    }
    paymentMap.get(p.admissionNo).push(p);
  });
  // 5️⃣ Final structured result
  console.log(
    allPayments.map((p) => ({
      admissionNo: p.admissionNo,
      utr: p.utrNumber,
      screenshot: p.screenshotUrl,
    })),
  );
  return academics.map((a) => {
    const fee = feeMap.get(a.admissionNo);
    const discount = discountMap.get(a.admissionNo) || 0;
    const pending = pendingCountMap.get(a.admissionNo) || 0;
    const payments = paymentMap.get(a.admissionNo) || [];

    return {
      admissionNo: a.admissionNo,
      name: a.student.name,
      class: a.class,
      fatherName: a.student.fatherName,
      motherName: a.student.motherName,
      totalFee: fee?.totalFee || 0,
      totalPaid: fee?.totalPaid || 0,
      balance: fee?.balance || 0,
      activeDiscount: discount,
      pendingCount: pending,
      payments, // 👈 NEW
    };
  });
};
