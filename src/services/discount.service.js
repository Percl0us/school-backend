import { prisma } from "../lib/prisma.js";

export const applyDiscountService = async (data, adminId) => {
  const { admissionNo, academicYear, amount } = data;

  // 1. Basic Validation
  if (!admissionNo || !academicYear || amount === undefined) {
    throw new Error("Missing required fields");
  }

  const discountValue = Number(amount);
  if (isNaN(discountValue) || discountValue < 0) {
    throw new Error("Discount must be a non-negative number");
  }

  return prisma.$transaction(async (tx) => {
    // 2. Fetch account inside transaction to prevent race conditions
    const feeAccount = await tx.studentFeeAccount.findUnique({
      where: {
        admissionNo_academicYear: { admissionNo, academicYear },
      },
    });

    if (!feeAccount) throw new Error("Fee account not found");
    if (feeAccount.status === "CLOSED") throw new Error("Cannot modify a closed account");

    // 3. Find the currently active discount
    const currentActiveDiscount = await tx.discount.findFirst({
      where: { admissionNo, academicYear, active: true },
    });

    // 4. Calculate the "Base Gross Fee" (Net Fee + Current Discount)
    // This allows us to reset the math correctly regardless of previous state.
    const currentDiscountAmount = currentActiveDiscount?.amount || 0;
    const baseGrossFee = feeAccount.totalFee + currentDiscountAmount;

    // 5. Validation against the Base Fee
    if (discountValue >= baseGrossFee) {
      throw new Error("Discount cannot exceed the total annual fee");
    }

    // Check if applying this discount makes the balance negative 
    // (Essentially: Base - Paid - NewDiscount < 0)
    if (baseGrossFee - feeAccount.totalPaid - discountValue < 0) {
        throw new Error("Discount exceeds the remaining outstanding balance");
    }

    // 6. Deactivate all existing discounts for this year
    await tx.discount.updateMany({
      where: { admissionNo, academicYear, active: true },
      data: { active: false },
    });

    // 7. Create new discount record (if amount > 0)
    if (discountValue > 0) {
      await tx.discount.create({
        data: {
          admissionNo,
          academicYear,
          amount: discountValue,
          active: true,
          appliedBy: adminId,
        },
      });
    }

    // 8. Update Fee Account with new Net Fee and Balance
    const newNetTotalFee = baseGrossFee - discountValue;
    
    // Formula for balance:
    // $$ \text{Balance} = \text{max}(0, \text{GrossFee} - \text{TotalPaid} - \text{Discount}) $$
    const newBalance = baseGrossFee - feeAccount.totalPaid - discountValue;

    return await tx.studentFeeAccount.update({
      where: {
        admissionNo_academicYear: { admissionNo, academicYear },
      },
      data: {
        totalFee: newNetTotalFee,
        balance: Math.max(0, newBalance),
      },
    });
  });
};