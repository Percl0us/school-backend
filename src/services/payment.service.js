import { prisma } from "../lib/prisma.js";
import { razorpay } from "./razorpay.service.js";
import crypto from "crypto";

/* =========================
   Academic Month Order
========================= */
const MONTH_ORDER = [
  "APR", "MAY", "JUN", "JUL", "AUG", "SEP",
  "OCT", "NOV", "DEC", "JAN", "FEB", "MAR",
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
   (Apr → Mar academic year)
========================= */
const calculateApplicableMonths = (feeStartMonth) => {
  // Apr–Dec + Jan–Mar
  if (feeStartMonth >= 4) {
    return 12 - feeStartMonth + 1 + 3;
  }

  // Jan–Mar
  return 3 - feeStartMonth + 1;
};

/* =========================
   CREATE ONLINE ORDER
========================= */
export const createOrderService = async (data) => {
  const { admissionNo, academicYear, paymentType, months } = data;

  if (!admissionNo || !academicYear || !paymentType) {
    throw new Error("Missing required fields");
  }

  // 1️⃣ Fetch fee account
  const feeAccount = await prisma.studentFeeAccount.findUnique({
    where: {
      admissionNo_academicYear: { admissionNo, academicYear },
    },
  });

  if (!feeAccount) {
    throw new Error("Fee account not found");
  }

  if (feeAccount.balance <= 0) {
    throw new Error("No outstanding balance");
  }

  let amountToPay = 0;
  let monthsCovered = [];

  /* =========================
     FULL PAYMENT
  ========================= */
  if (paymentType === "FULL") {
    amountToPay = feeAccount.balance;
  }

  /* =========================
     MONTHS PAYMENT
  ========================= */
  if (paymentType === "MONTHS") {
    if (!Array.isArray(months) || months.length === 0) {
      throw new Error("Months required for MONTHS payment");
    }

    // Fetch academic record
    const academic = await prisma.studentAcademic.findUnique({
      where: {
        admissionNo_academicYear: { admissionNo, academicYear },
      },
    });

    if (!academic) {
      throw new Error("Academic record not found");
    }

    // Fetch confirmed payments
    const confirmedPayments = await prisma.payment.findMany({
      where: {
        admissionNo,
        academicYear,
        status: "CONFIRMED",
      },
    });

    // Build paid months set
    const paidMonthsSet = new Set();
    confirmedPayments.forEach((p) => {
      if (Array.isArray(p.monthsCovered)) {
        p.monthsCovered.forEach((m) => paidMonthsSet.add(m));
      }
    });

    // Find academic start index
    const startIndex = MONTH_ORDER.findIndex(
      (m) => MONTH_TO_NUMBER[m] === academic.feeStartMonth
    );

    if (startIndex === -1) {
      throw new Error("Invalid fee start month configuration");
    }

    const unpaidMonthsInOrder = MONTH_ORDER
      .slice(startIndex)
      .filter((m) => !paidMonthsSet.has(m));

    const firstUnpaidMonth = unpaidMonthsInOrder[0];

    // Must include oldest unpaid month
    if (!months.includes(firstUnpaidMonth)) {
      throw new Error(
        `Please clear earlier dues first. Pending from ${firstUnpaidMonth}.`
      );
    }

    // Must be consecutive unpaid months
    for (let i = 0; i < months.length; i++) {
      if (months[i] !== unpaidMonthsInOrder[i]) {
        throw new Error("Selected months must be consecutive unpaid months");
      }
    }

    /* =========================
       ✅ CORRECT MONTHLY AMOUNT
       based on applicable months
    ========================= */
    const applicableMonths = calculateApplicableMonths(
      academic.feeStartMonth
    );

    const monthlyAmount = Math.round(
      feeAccount.totalFee / applicableMonths
    );

    amountToPay = months.length * monthlyAmount;

    // Final safety guard
    amountToPay = Math.min(amountToPay, feeAccount.balance);

    monthsCovered = months;
  }

  amountToPay = Math.round(amountToPay);

  if (amountToPay > feeAccount.balance) {
    throw new Error("Payment exceeds outstanding balance");
  }

  /* =========================
     CREATE RAZORPAY ORDER
  ========================= */
  const order = await razorpay.orders.create({
    amount: amountToPay * 100,
    currency: "INR",
    receipt: `fee_${admissionNo}_${Date.now()}`,
  });

  /* =========================
     CREATE PENDING PAYMENT
  ========================= */
  await prisma.payment.create({
    data: {
      admissionNo,
      academicYear,
      amount: amountToPay,
      mode: "ONLINE",
      status: "PENDING",
      razorpayOrderId: order.id,
      monthsCovered,
    },
  });

  return {
    razorpayOrderId: order.id,
    amount: amountToPay,
    currency: "INR",
    key: process.env.RAZORPAY_KEY_ID,
  };
};

/* =========================
   VERIFY ONLINE PAYMENT
========================= */
export const verifyPaymentService = async ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error("Missing payment verification fields");
  }

  const body = razorpayOrderId + "|" + razorpayPaymentId;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    throw new Error("Invalid payment signature");
  }

  const payment = await prisma.payment.findFirst({
    where: {
      razorpayOrderId,
      status: "PENDING",
    },
  });

  if (!payment) {
    throw new Error("Payment not found or already processed");
  }

  const result = await prisma.$transaction(async (tx) => {
    const confirmedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "CONFIRMED",
        razorpayPaymentId,
        receiptNumber: `RCPT-${Date.now()}`,
      },
    });

    const updatedAccount = await tx.studentFeeAccount.update({
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

    return { confirmedPayment, updatedAccount };
  });

  return {
    message: "Payment verified successfully",
    receiptNumber: result.confirmedPayment.receiptNumber,
    paymentId: result.confirmedPayment.id, 
    feeAccount: {
      totalPaid: result.updatedAccount.totalPaid,
      balance: result.updatedAccount.balance,
    },
  };
};

/* =========================
   CREATE CASH PAYMENT
========================= */
export const createCashPaymentService = async (data, adminId) => {
  const { admissionNo, academicYear, amount, monthsCovered } = data;

  if (!admissionNo || !academicYear || amount === undefined) {
    throw new Error("Missing required fields");
  }

  if (amount <= 0) {
    throw new Error("Invalid payment amount");
  }

  const feeAccount = await prisma.studentFeeAccount.findUnique({
    where: {
      admissionNo_academicYear: { admissionNo, academicYear },
    },
  });

  if (!feeAccount) {
    throw new Error("Fee account not found");
  }

  if (feeAccount.balance <= 0) {
    throw new Error("No outstanding balance");
  }

  if (amount > feeAccount.balance) {
    throw new Error("Payment exceeds outstanding balance");
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        admissionNo,
        academicYear,
        amount,
        mode: "CASH",
        status: "CONFIRMED",
        monthsCovered: monthsCovered ?? [],
        collectedBy: adminId,
      },
    });

    const receiptNumber = `TPS/${academicYear}/${String(payment.id).padStart(6, "0")}`;

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: { receiptNumber },
    });

    const updatedAccount = await tx.studentFeeAccount.update({
      where: {
        admissionNo_academicYear: { admissionNo, academicYear },
      },
      data: {
        totalPaid: { increment: amount },
        balance: { decrement: amount },
      },
    });

    return { payment: updatedPayment, updatedAccount };
  });

  return {
    message: "Cash payment recorded successfully",
    paymentId: result.payment.id,
    receiptNumber: result.payment.receiptNumber,
    feeAccount: {
      totalPaid: result.updatedAccount.totalPaid,
      balance: result.updatedAccount.balance,
    },
  };
};
