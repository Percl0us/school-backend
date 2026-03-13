import { prisma } from "../lib/prisma.js";

/**
 * List all students for a specific session with payment status
 * Now includes parent details from the Student model.
 */
export const listStudentsBySessionService = async (academicYear) => {
  if (!academicYear) {
    throw new Error("Academic year required");
  }

  const students = await prisma.studentAcademic.findMany({
    where: { academicYear },
    include: {
      student: {
        include: {
          feeAccounts: {
            where: { academicYear },
          },
        },
      },
    },
  });

  return students.map((record) => {
    const feeAccount = record.student.feeAccounts[0];

    return {
      admissionNo: record.admissionNo,
      name: record.student.name,
      // Fetching the new parent fields from the student relation
      fatherName: record.student.fatherName, 
      motherName: record.student.motherName,
      class: record.class,
      section: record.section,
      totalFee: feeAccount?.totalFee || 0,
      totalPaid: feeAccount?.totalPaid || 0,
      balance: feeAccount?.balance || 0,
    };
  });
};

/**
 * Fetch unique classes defined in the fee structure for a session
 */
export const listClassesBySessionService = async (academicYear) => {
  const classes = await prisma.feeStructure.findMany({
    where: { academicYear },
    select: { class: true },
    distinct: ['class'], // Ensures unique class names
    orderBy: { class: "asc" },
  });

  return classes.map((c) => c.class);
};

/**
 * Bulk promote students to a new class and academic session
 */
export const promoteStudentsService = async (data) => {
  const {
    academicYear,
    newAcademicYear,
    currentClass,
    newClass,
    admissionNos,
  } = data;

  if (
    !academicYear ||
    !newAcademicYear ||
    !currentClass ||
    !newClass ||
    !Array.isArray(admissionNos) ||
    admissionNos.length === 0
  ) {
    throw new Error("Invalid promotion data");
  }

  // Get new fee structure to initialize the student's account
  const feeStructure = await prisma.feeStructure.findUnique({
    where: {
      academicYear_class: {
        academicYear: newAcademicYear,
        class: newClass,
      },
    },
  });

  if (!feeStructure) {
    throw new Error(`Fee structure not defined for ${newClass} in ${newAcademicYear}`);
  }

  const results = [];

  // Transaction ensures that if one student fails, the whole batch is rolled back
  await prisma.$transaction(async (tx) => {
    for (const admissionNo of admissionNos) {
      // 1. Check if student is already in the target session
      const existingAcademic = await tx.studentAcademic.findUnique({
        where: {
          admissionNo_academicYear: {
            admissionNo,
            academicYear: newAcademicYear,
          },
        },
      });

      if (existingAcademic) {
        throw new Error(`Student ${admissionNo} is already enrolled in ${newAcademicYear}`);
      }

      // 2. Create target session academic record
      await tx.studentAcademic.create({
        data: {
          admissionNo,
          academicYear: newAcademicYear,
          class: newClass,
          section: null, // Reset section for new session
          feeStartMonth: 4,
          transportOpted: false,
          transportFee: null,
        },
      });

      // 3. Initialize Financial Account for the new session
      const totalFee = feeStructure.tuitionFee; // Assuming tuitionFee is the total annual amount

      await tx.studentFeeAccount.create({
        data: {
          admissionNo,
          academicYear: newAcademicYear,
          totalFee,
          totalPaid: 0,
          balance: totalFee,
        },
      });

      results.push(admissionNo);
    }
  });

  return {
    message: `Successfully promoted ${results.length} students to ${newClass}`,
    promoted: results,
  };
};