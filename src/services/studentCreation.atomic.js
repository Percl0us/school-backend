import { prisma } from "../lib/prisma.js";

export const createStudentAtomic = async (tx, data) => {
  const {
    admissionNo,
    name,
    dob,
    academicYear,
    fatherName,
    motherName,
    class: studentClass,
    section,
    feeStartMonth,
    transportOpted,
    transportFee,
  } = data;

  if (!admissionNo || !name || !dob || !academicYear || !studentClass) {
    throw new Error("Missing required fields");
  }

  if (feeStartMonth < 1 || feeStartMonth > 12) {
    throw new Error("Invalid fee start month");
  }

  if (transportOpted && (transportFee === undefined || transportFee === null)) {
    throw new Error("Transport fee required if transport is opted");
  }

  if (!transportOpted && transportFee) {
    throw new Error("Transport fee should not be provided if transport is not opted");
  }

  const existingStudent = await tx.student.findUnique({
    where: { admissionNo },
  });

  if (existingStudent) {
    throw new Error("Student with this admission number already exists");
  }

  const feeStructure = await tx.feeStructure.findUnique({
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

  const calculateAcademicMonths = (startMonth) => {
    const SESSION_START = 4;
    const SESSION_END = 3;

    if (startMonth >= SESSION_START) {
      return 12 - startMonth + 1 + SESSION_END;
    }

    return SESSION_END - startMonth + 1;
  };

  const monthsApplicable = calculateAcademicMonths(feeStartMonth);

  const monthlyTuition = Math.round(feeStructure.tuitionFee / 12);
  const monthlyTransport = transportOpted
    ? Math.round(transportFee / 12)
    : 0;

  const monthlyTotal = monthlyTuition + monthlyTransport;
  const totalFee = Math.round(monthsApplicable * monthlyTotal);

  await tx.student.create({
    data: {
      admissionNo,
      name,
      fatherName,
      motherName,
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
      totalFee,
      totalPaid: 0,
      balance: totalFee,
    },
  });
};