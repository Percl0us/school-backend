import { prisma } from "../lib/prisma.js";

export const applyDiscountService = async (data, adminId) => {
  const { admissionNo, academicYear, amount, reason } = data;

  // 1️⃣ Validation
  if (!admissionNo || !academicYear || amount === undefined) {
    throw new Error("Missing required fields");
  }

  if (amount <= 0) {
    throw new Error("Discount amount must be greater than zero");
  }

  // 2️⃣ Fetch fee account
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

  // Prevent nonsense
  if (amount >= feeAccount.totalFee + feeAccount.totalPaid) {
    throw new Error("Discount cannot exceed total fee");
  }

  // 3️⃣ Transaction: deactivate old discounts, add new, recalc account
  const result = await prisma.$transaction(async (tx) => {
    // Deactivate existing active discounts
    await tx.discount.updateMany({
      where: {
        admissionNo,
        academicYear,
        active: true,
      },
      data: { active: false },
    });

    // Create new discount
    await tx.discount.create({
      data: {
        admissionNo,
        academicYear,
        amount,
        active: true,
        appliedBy: adminId,
        // reason can be added later as a column if you want
      },
    });

    // Recalculate totals
    const newTotalFee = feeAccount.totalFee - amount;
    const newBalance = Math.max(
      newTotalFee - feeAccount.totalPaid,
      0
    );

    const updatedAccount = await tx.studentFeeAccount.update({
      where: {
        admissionNo_academicYear: {
          admissionNo,
          academicYear,
        },
      },
      data: {
        totalFee: newTotalFee,
        balance: newBalance,
      },
    });

    return updatedAccount;
  });

  return {
    message: "Discount applied successfully",
    feeAccount: {
      totalFee: result.totalFee,
      totalPaid: result.totalPaid,
      balance: result.balance,
    },
  };
};
