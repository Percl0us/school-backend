import { prisma } from "../lib/prisma.js";

/* =========================
   Academic Month Order
========================= */
const MONTH_ORDER = [
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
  "JAN",
  "FEB",
  "MAR",
];

const MONTH_TO_NUMBER = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

/* =========================
   Applicable Months Calculator
========================= */
const calculateApplicableMonths = (feeStartMonth) => {
  // Logic: Total months from start month to March of next year
  if (feeStartMonth >= 4) {
    return 12 - feeStartMonth + 1 + 3;
  }
  return 3 - feeStartMonth + 1;
};

/* =========================
   CORE PAYMENT CALCULATOR
========================= */
/**
 * @param {object} tx - Prisma Client or Transaction Client
 */
const calculatePaymentDetails = async (
  tx,
  { admissionNo, academicYear, paymentType, months, skipPendingCheck = false },
) => {
  const feeAccount = await tx.studentFeeAccount.findUnique({
    where: { admissionNo_academicYear: { admissionNo, academicYear } },
  });

  if (!feeAccount) throw new Error("Fee account not found");
  if (feeAccount.balance <= 0) throw new Error("No outstanding balance");

  const academic = await tx.studentAcademic.findUnique({
    where: { admissionNo_academicYear: { admissionNo, academicYear } },
  });

  if (!academic) throw new Error("Academic record not found");

  // Prevent multiple pending submissions to avoid double-charging
  if (!skipPendingCheck) {
    const existingPending = await tx.payment.findFirst({
      where: {
        admissionNo,
        academicYear,
        status: { in: ["AWAITING_PAYMENT", "PAYMENT_SUBMITTED"] },
      },
    });
    if (existingPending) throw new Error("A payment is already under review.");
  }

  let amountToPay = 0;
  let monthsCovered = [];

  if (paymentType === "FULL") {
    amountToPay = feeAccount.balance;
    monthsCovered = []; // Usually left empty for full clear, or filled with remaining
  } else if (paymentType === "MONTHS") {
    if (!Array.isArray(months) || months.length === 0) {
      throw new Error("Months required for MONTHS payment");
    }

    const confirmedPayments = await tx.payment.findMany({
      where: { admissionNo, academicYear, status: "CONFIRMED" },
    });

    const paidMonthsSet = new Set();
    confirmedPayments.forEach((p) => {
      if (Array.isArray(p.monthsCovered)) {
        p.monthsCovered.forEach((m) => paidMonthsSet.add(m));
      }
    });

    const startIndex = MONTH_ORDER.findIndex(
      (m) => MONTH_TO_NUMBER[m] === academic.feeStartMonth,
    );
    if (startIndex === -1)
      throw new Error("Invalid fee start month configuration");

    // Filter order to get only unpaid months
    const unpaidMonthsInOrder = MONTH_ORDER.slice(startIndex).filter(
      (m) => !paidMonthsSet.has(m),
    );
    const firstUnpaidMonth = unpaidMonthsInOrder[0];

    // Validation: Prevent skipping months
    if (!months.includes(firstUnpaidMonth)) {
      throw new Error(
        `Please clear earlier dues first. Pending from ${firstUnpaidMonth}.`,
      );
    }

    // Validation: Ensure selection is consecutive
    for (let i = 0; i < months.length; i++) {
      if (months[i] !== unpaidMonthsInOrder[i]) {
        throw new Error("Selected months must be consecutive unpaid months");
      }
    }

    const applicableMonthsCount = calculateApplicableMonths(
      academic.feeStartMonth,
    );

    /**
     * FIX: Penny Drift
     * We calculate the total value of selected months first, then round,
     * to ensure the sum of individual payments equals the total fee.
     */
    amountToPay = Math.round(
      (feeAccount.totalFee / applicableMonthsCount) * months.length,
    );

    // Ensure we don't accidentally ask for more than the current balance due to rounding
    amountToPay = Math.min(amountToPay, feeAccount.balance);
    monthsCovered = months;
  }

  if (amountToPay <= 0) throw new Error("Invalid payment amount");

  return { amountToPay: Math.round(amountToPay), monthsCovered };
};

/* =========================
   CREATE QR (UPI) QUOTE
========================= */
export const quotePaymentService = async (data) => {
  let { months, admissionNo, academicYear, paymentType } = data;

  if (typeof months === "string") {
    try {
      months = JSON.parse(months);
    } catch {
      months = [];
    }
  }

  if (!admissionNo || !academicYear || !paymentType) {
    throw new Error("Missing required fields");
  }

  // Uses standard prisma client for read-only quote
  const { amountToPay, monthsCovered } = await calculatePaymentDetails(prisma, {
    admissionNo,
    academicYear,
    paymentType,
    months,
  });

  return {
    amount: amountToPay,
    monthsCovered,
    upiId: process.env.SCHOOL_UPI_ID,
  };
};

/* =========================
   SUBMIT UPI PROOF
========================= */
export const submitPaymentProofService = async (data, screenshotUrl) => {
  let { admissionNo, academicYear, paymentType, months, utrNumber } = data;

  if (typeof months === "string") {
    try {
      months = JSON.parse(months);
    } catch {
      months = [];
    }
  }

  if (!utrNumber) throw new Error("UTR number required");

  // Check for duplicate UTR to prevent double submission
  const duplicateUTR = await prisma.payment.findFirst({ where: { utrNumber } });
  if (duplicateUTR)
    throw new Error("This UTR number has already been submitted.");

  const { amountToPay, monthsCovered } = await calculatePaymentDetails(prisma, {
    admissionNo,
    academicYear,
    paymentType,
    months,
  });

  return prisma.payment.create({
    data: {
      admissionNo,
      academicYear,
      amount: amountToPay,
      mode: "UPI",
      status: "PAYMENT_SUBMITTED",
      monthsCovered,
      utrNumber,
      screenshotUrl,
    },
  });
};

/* =========================
   ADMIN CONFIRM UPI PAYMENT
========================= */
export const confirmUPIPaymentService = async (paymentId, adminId) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment || payment.status !== "PAYMENT_SUBMITTED") {
    throw new Error("Payment not found or already processed");
  }

  return prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "CONFIRMED",
        receiptNumber: `TPS/${payment.academicYear}/${Date.now()}`,
        collectedBy: adminId,
      },
    });

    await tx.studentFeeAccount.update({
      where: {
        admissionNo_academicYear: {
          admissionNo: payment.admissionNo,
          academicYear: payment.academicYear,
        },
      },
      data: {
        totalPaid: { increment: payment.amount },
        balance: { decrement: payment.amount },
      },
    });

    return updatedPayment;
  });
};

/* =========================
   CREATE CASH PAYMENT (ADMIN)
========================= */
export const createCashPaymentService = async (data, adminId) => {
  const { admissionNo, academicYear, paymentType, months } = data;

  if (!admissionNo || !academicYear || !paymentType) {
    throw new Error("Missing required fields");
  }

  return prisma.$transaction(async (tx) => {
    // Calculation inside transaction to ensure balance hasn't changed
    const { amountToPay, monthsCovered } = await calculatePaymentDetails(tx, {
      admissionNo,
      academicYear,
      paymentType,
      months,
      skipPendingCheck: true,
    });

    const payment = await tx.payment.create({
      data: {
        admissionNo,
        academicYear,
        amount: amountToPay,
        mode: "CASH",
        status: "CONFIRMED",
        monthsCovered,
        collectedBy: adminId,
      },
    });

    const receiptNumber = `TPS/${academicYear}/${String(payment.id).padStart(6, "0")}`;

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: { receiptNumber },
    });

    await tx.studentFeeAccount.update({
      where: {
        admissionNo_academicYear: { admissionNo, academicYear },
      },
      data: {
        totalPaid: { increment: amountToPay },
        balance: { decrement: amountToPay },
      },
    });

    return updatedPayment;
  });
};

/* =========================
   REJECT UPI PAYMENT
========================= */
export const rejectUPIPaymentService = async (paymentId, adminId) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment || payment.status !== "PAYMENT_SUBMITTED") {
    throw new Error("Invalid payment state for rejection");
  }

  return prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "REJECTED",
      collectedBy: adminId,
    },
  });
};
