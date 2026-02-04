import { prisma } from "../lib/prisma.js";

export const createStudentService = async (data) => {
  const {
    admissionNo,
    name,
    dob,
    academicYear,
    class: studentClass,
    section,
    feeStartMonth,
    transportOpted,
    transportFee, // 👈 NEW (student-wise)
  } = data;

  // 1️⃣ Basic validation
  if (!admissionNo || !name || !dob || !academicYear || !studentClass) {
    throw new Error("Missing required fields");
  }

  if (feeStartMonth < 1 || feeStartMonth > 12) {
    throw new Error("Invalid fee start month");
  }

  // 2️⃣ Transport validation (IMPORTANT)
  if (transportOpted && (transportFee === undefined || transportFee === null)) {
    throw new Error("Transport fee required if transport is opted");
  }

  if (!transportOpted && transportFee) {
    throw new Error(
      "Transport fee should not be provided if transport is not opted",
    );
  }

  // 3️⃣ Check if student already exists
  const existingStudent = await prisma.student.findUnique({
    where: { admissionNo },
  });

  if (existingStudent) {
    throw new Error("Student with this admission number already exists");
  }

  // 4️⃣ Get fee structure (tuition only)
  const feeStructure = await prisma.feeStructure.findUnique({
    where: {
      academicYear_class: {
        academicYear,
        class: studentClass,
      },
    },
  });

  if (!feeStructure) {
    throw new Error("Fee structure not defined for this class and year");
  }

  // 5️⃣ Academic-session-aware month calculation (Apr–Mar)
  const calculateAcademicMonths = (startMonth) => {
    const SESSION_START = 4; // April
    const SESSION_END = 3; // March

    if (startMonth >= SESSION_START) {
      // Apr–Dec
      return 12 - startMonth + 1 + SESSION_END;
    }

    // Jan–Mar
    return SESSION_END - startMonth + 1;
  };

  const monthsApplicable = calculateAcademicMonths(feeStartMonth);

  // 6️⃣ Monthly fee calculation
  // 6️⃣ Monthly fee calculation (ROUND FIRST)
  const monthlyTuition = Math.round(feeStructure.tuitionFee / 12);
  const monthlyTransport = transportOpted ? Math.round(transportFee / 12) : 0;

  const monthlyTotal = monthlyTuition + monthlyTransport;

  const totalFee = monthsApplicable * monthlyTotal;

  // 7️⃣ Transaction: create student + academic + fee account
  const student = await prisma.$transaction(async (tx) => {
    const createdStudent = await tx.student.create({
      data: {
        admissionNo,
        name,
        dob: new Date(dob),
      },
    });

    await tx.studentAcademic.create({
      data: {
        admissionNo,
        academicYear,
        class: studentClass,
        section,
        feeStartMonth,
        transportOpted,
        transportFee: transportOpted ? transportFee : null,
      },
    });

    await tx.studentFeeAccount.create({
      data: {
        admissionNo,
        academicYear,
        totalFee: Math.round(totalFee),
        totalPaid: 0,
        balance: Math.round(totalFee),
      },
    });

    return createdStudent;
  });

  return student;
};
