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

const VALID_PAYMENT_TYPES = new Set(["FULL", "MONTHS"]);

const normalizeMonths = (months) => {
  if (!Array.isArray(months)) return [];

  return [...new Set(
    months
      .map((month) => String(month || "").trim().toUpperCase())
      .filter((month) => MONTH_ORDER.includes(month)),
  )];
};

const getApplicableMonthsInOrder = (feeStartMonth) => {
  const startIndex = MONTH_ORDER.findIndex(
    (month) => MONTH_TO_NUMBER[month] === feeStartMonth,
  );

  if (startIndex === -1) {
    throw new Error("Invalid fee start month configuration");
  }

  return MONTH_ORDER.slice(startIndex);
};

const buildReceiptNumber = (payment) =>
  `TPS/${payment.academicYear}/${String(payment.id).replace(/-/g, "").slice(0, 10).toUpperCase()}`;

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
  if (!VALID_PAYMENT_TYPES.has(paymentType)) {
    throw new Error("Invalid payment type");
  }

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
    const confirmedPayments = await tx.payment.findMany({
      where: { admissionNo, academicYear, status: "CONFIRMED" },
      select: { monthsCovered: true },
    });

    const paidMonthsSet = new Set();
    confirmedPayments.forEach((payment) => {
      if (Array.isArray(payment.monthsCovered)) {
        payment.monthsCovered.forEach((month) => paidMonthsSet.add(month));
      }
    });

    monthsCovered = getApplicableMonthsInOrder(academic.feeStartMonth).filter(
      (month) => !paidMonthsSet.has(month),
    );
  } else if (paymentType === "MONTHS") {
    const normalizedMonths = normalizeMonths(months);

    if (normalizedMonths.length === 0) {
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

    const unpaidMonthsInOrder = getApplicableMonthsInOrder(
      academic.feeStartMonth,
    ).filter(
      (m) => !paidMonthsSet.has(m),
    );
    const firstUnpaidMonth = unpaidMonthsInOrder[0];

    // Validation: Prevent skipping months
    if (!normalizedMonths.includes(firstUnpaidMonth)) {
      throw new Error(
        `Please clear earlier dues first. Pending from ${firstUnpaidMonth}.`,
      );
    }

    // Validation: Ensure selection is consecutive
    for (let i = 0; i < normalizedMonths.length; i++) {
      if (normalizedMonths[i] !== unpaidMonthsInOrder[i]) {
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
      (feeAccount.totalFee / applicableMonthsCount) * normalizedMonths.length,
    );

    // Ensure we don't accidentally ask for more than the current balance due to rounding
    amountToPay = Math.min(amountToPay, feeAccount.balance);
    monthsCovered = normalizedMonths;
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

  const normalizedUTR = String(utrNumber || "").trim().toUpperCase();

  if (!normalizedUTR) throw new Error("UTR number required");
  if (normalizedUTR.length < 6 || normalizedUTR.length > 30) {
    throw new Error("UTR number must be between 6 and 30 characters");
  }

  // Check for duplicate UTR to prevent double submission
  const duplicateUTR = await prisma.payment.findFirst({ where: { utrNumber: normalizedUTR } });
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
      utrNumber: normalizedUTR,
      screenshotUrl,
    },
  });
};

/* =========================
   ADMIN CONFIRM UPI PAYMENT
========================= */
export const confirmUPIPaymentService = async (paymentId, adminId) => {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.status !== "PAYMENT_SUBMITTED") {
      throw new Error("Payment not found or already processed");
    }

    const feeAccount = await tx.studentFeeAccount.findUnique({
      where: {
        admissionNo_academicYear: {
          admissionNo: payment.admissionNo,
          academicYear: payment.academicYear,
        },
      },
    });

    if (!feeAccount) {
      throw new Error("Fee account not found");
    }

    if (payment.amount > feeAccount.balance) {
      throw new Error("Payment amount exceeds the current outstanding balance. Review discounts or other payments first.");
    }

    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "CONFIRMED",
        receiptNumber: buildReceiptNumber(payment),
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
        totalPaid: feeAccount.totalPaid + payment.amount,
        balance: Math.max(0, feeAccount.balance - payment.amount),
        status: feeAccount.balance - payment.amount <= 0 ? "CLOSED" : "OPEN",
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
      skipPendingCheck: false,
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

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: { receiptNumber: buildReceiptNumber(payment) },
    });

    const feeAccount = await tx.studentFeeAccount.findUnique({
      where: {
        admissionNo_academicYear: { admissionNo, academicYear },
      },
    });

    if (!feeAccount) {
      throw new Error("Fee account not found");
    }

    await tx.studentFeeAccount.update({
      where: {
        admissionNo_academicYear: { admissionNo, academicYear },
      },
      data: {
        totalPaid: feeAccount.totalPaid + amountToPay,
        balance: Math.max(0, feeAccount.balance - amountToPay),
        status: feeAccount.balance - amountToPay <= 0 ? "CLOSED" : "OPEN",
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
