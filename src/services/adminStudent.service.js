import { prisma } from "../lib/prisma.js";

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const parseBoolean = (value) => value === true || value === "true";

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const calculateAcademicMonths = (startMonth) => {
  const sessionStart = 4;
  const sessionEnd = 3;

  if (startMonth >= sessionStart) {
    return 12 - startMonth + 1 + sessionEnd;
  }

  return sessionEnd - startMonth + 1;
};

const computeFeeSummary = ({
  tuitionFee,
  feeStartMonth,
  transportOpted,
  transportFee,
  totalPaid,
  activeDiscount,
}) => {
  const monthsApplicable = calculateAcademicMonths(feeStartMonth);
  const monthlyTuition = Math.round(tuitionFee / 12);
  const monthlyTransport = transportOpted
    ? Math.round((transportFee || 0) / 12)
    : 0;
  const grossFee = Math.round(monthsApplicable * (monthlyTuition + monthlyTransport));
  const netFee = Math.max(0, grossFee - activeDiscount);
  const balance = Math.max(0, grossFee - totalPaid - activeDiscount);

  return { netFee, balance };
};

const validateStudentPayload = (data) => {
  const admissionNo = normalizeString(data.admissionNo)?.toUpperCase();
  const name = normalizeString(data.name);
  const dobValue = normalizeString(data.dob);
  const academicYear = normalizeString(data.academicYear);
  const studentClass = normalizeString(data.class);
  const section = normalizeString(data.section)?.toUpperCase() || null;
  const fatherName = normalizeString(data.fatherName);
  const motherName = normalizeString(data.motherName);
  const feeStartMonth = Number(data.feeStartMonth);
  const transportOpted = parseBoolean(data.transportOpted);
  const transportFee = parseOptionalNumber(data.transportFee);

  if (!admissionNo || !name || !dobValue || !academicYear || !studentClass) {
    throw new Error("Admission number, name, date of birth, class, and academic year are required");
  }

  const dob = new Date(dobValue);
  if (Number.isNaN(dob.getTime())) {
    throw new Error("Invalid date of birth");
  }

  if (!Number.isInteger(feeStartMonth) || feeStartMonth < 1 || feeStartMonth > 12) {
    throw new Error("Fee start month must be between 1 and 12");
  }

  if (transportOpted) {
    if (!Number.isFinite(transportFee) || transportFee <= 0) {
      throw new Error("Transport fee must be greater than 0 when transport is enabled");
    }
  } else if (transportFee !== null) {
    throw new Error("Transport fee can only be provided when transport is enabled");
  }

  return {
    admissionNo,
    name,
    dob,
    academicYear,
    class: studentClass,
    section,
    fatherName,
    motherName,
    feeStartMonth,
    transportOpted,
    transportFee: transportOpted ? transportFee : null,
  };
};

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
    orderBy: [
      { class: "asc" },
      { section: "asc" },
      { student: { name: "asc" } },
    ],
  });

  return students.map((record) => {
    const feeAccount = record.student.feeAccounts[0];

    return {
      admissionNo: record.admissionNo,
      name: record.student.name,
      fatherName: record.student.fatherName,
      motherName: record.student.motherName,
      dob: record.student.dob,
      profileImageUrl: record.student.profileImageUrl,
      class: record.class,
      section: record.section,
      feeStartMonth: record.feeStartMonth,
      transportOpted: record.transportOpted,
      transportFee: record.transportFee,
      totalFee: feeAccount?.totalFee || 0,
      totalPaid: feeAccount?.totalPaid || 0,
      balance: feeAccount?.balance || 0,
    };
  });
};

export const getStudentDetailService = async (admissionNo, academicYear) => {
  if (!admissionNo || !academicYear) {
    throw new Error("Admission number and academic year are required");
  }

  const student = await prisma.student.findUnique({
    where: { admissionNo },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  const [academic, feeAccount, activeDiscount] = await Promise.all([
    prisma.studentAcademic.findUnique({
      where: {
        admissionNo_academicYear: { admissionNo, academicYear },
      },
    }),
    prisma.studentFeeAccount.findUnique({
      where: {
        admissionNo_academicYear: { admissionNo, academicYear },
      },
    }),
    prisma.discount.findFirst({
      where: { admissionNo, academicYear, active: true },
      orderBy: { appliedAt: "desc" },
    }),
  ]);

  if (!academic) {
    throw new Error("Student is not enrolled in the selected academic year");
  }

  return {
    admissionNo: student.admissionNo,
    name: student.name,
    dob: student.dob,
    fatherName: student.fatherName,
    motherName: student.motherName,
    profileImageUrl: student.profileImageUrl,
    academicYear,
    class: academic.class,
    section: academic.section,
    feeStartMonth: academic.feeStartMonth,
    transportOpted: academic.transportOpted,
    transportFee: academic.transportFee,
    feeAccount,
    activeDiscount: activeDiscount?.amount || 0,
  };
};

export const listClassesBySessionService = async (academicYear) => {
  const classes = await prisma.feeStructure.findMany({
    where: { academicYear },
    select: { class: true },
    distinct: ["class"],
    orderBy: { class: "asc" },
  });

  return classes.map((c) => c.class);
};

export const updateStudentService = async (admissionNo, data) => {
  const payload = validateStudentPayload({
    ...data,
    admissionNo,
  });

  const existingStudent = await prisma.student.findUnique({
    where: { admissionNo: payload.admissionNo },
  });

  if (!existingStudent) {
    throw new Error("Student not found");
  }

  await prisma.$transaction(async (tx) => {
    // Interactive transactions run on a single connection, so keep queries
    // sequential here instead of batching them with Promise.all.
    const academic = await tx.studentAcademic.findUnique({
      where: {
        admissionNo_academicYear: {
          admissionNo: payload.admissionNo,
          academicYear: payload.academicYear,
        },
      },
    });
    const feeAccount = await tx.studentFeeAccount.findUnique({
      where: {
        admissionNo_academicYear: {
          admissionNo: payload.admissionNo,
          academicYear: payload.academicYear,
        },
      },
    });
    const activeDiscount = await tx.discount.findFirst({
      where: {
        admissionNo: payload.admissionNo,
        academicYear: payload.academicYear,
        active: true,
      },
      orderBy: { appliedAt: "desc" },
    });
    const feeStructure = await tx.feeStructure.findUnique({
      where: {
        academicYear_class: {
          academicYear: payload.academicYear,
          class: payload.class,
        },
      },
    });

    if (!academic) {
      throw new Error("Student is not enrolled in the selected academic year");
    }

    if (!feeAccount) {
      throw new Error("Fee account not found for this student");
    }

    if (!feeStructure) {
      throw new Error("Fee structure not defined for this class and year");
    }

    const { netFee, balance } = computeFeeSummary({
      tuitionFee: feeStructure.tuitionFee,
      feeStartMonth: payload.feeStartMonth,
      transportOpted: payload.transportOpted,
      transportFee: payload.transportFee,
      totalPaid: feeAccount.totalPaid,
      activeDiscount: activeDiscount?.amount || 0,
    });

    await tx.student.update({
      where: { admissionNo: payload.admissionNo },
      data: {
        name: payload.name,
        dob: payload.dob,
        fatherName: payload.fatherName,
        motherName: payload.motherName,
        profileImageUrl: data.profileImageUrl ?? existingStudent.profileImageUrl,
      },
    });

    await tx.studentAcademic.update({
      where: {
        admissionNo_academicYear: {
          admissionNo: payload.admissionNo,
          academicYear: payload.academicYear,
        },
      },
      data: {
        class: payload.class,
        section: payload.section,
        feeStartMonth: payload.feeStartMonth,
        transportOpted: payload.transportOpted,
        transportFee: payload.transportFee,
      },
    });

    await tx.studentFeeAccount.update({
      where: {
        admissionNo_academicYear: {
          admissionNo: payload.admissionNo,
          academicYear: payload.academicYear,
        },
      },
      data: {
        totalFee: netFee,
        balance,
        status: balance <= 0 ? "CLOSED" : "OPEN",
      },
    });
  });

  return getStudentDetailService(payload.admissionNo, payload.academicYear);
};

export const deleteStudentService = async (admissionNo) => {
  if (!admissionNo) {
    throw new Error("Admission number is required");
  }

  const existingStudent = await prisma.student.findUnique({
    where: { admissionNo },
  });

  if (!existingStudent) {
    throw new Error("Student not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.result.deleteMany({ where: { admissionNo } });
    await tx.discount.deleteMany({ where: { admissionNo } });
    await tx.payment.deleteMany({ where: { admissionNo } });
    await tx.studentFeeAccount.deleteMany({ where: { admissionNo } });
    await tx.studentAcademic.deleteMany({ where: { admissionNo } });
    await tx.student.delete({ where: { admissionNo } });
  });

  return {
    success: true,
    message: `Student ${admissionNo} deleted successfully`,
  };
};

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

  if (academicYear === newAcademicYear) {
    throw new Error("New academic year must be different from the current academic year");
  }

  const uniqueAdmissionNos = [...new Set(admissionNos.map((value) => String(value).trim()))].filter(Boolean);

  if (uniqueAdmissionNos.length === 0) {
    throw new Error("Select at least one valid student to promote");
  }

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

  await prisma.$transaction(async (tx) => {
    const academicRecords = await tx.studentAcademic.findMany({
      where: {
        academicYear,
        class: currentClass,
        admissionNo: { in: uniqueAdmissionNos },
      },
      include: {
        student: true,
      },
    });

    if (academicRecords.length !== uniqueAdmissionNos.length) {
      const found = new Set(academicRecords.map((record) => record.admissionNo));
      const missing = uniqueAdmissionNos.filter((admissionNo) => !found.has(admissionNo));
      throw new Error(
        `Some students are not enrolled in ${currentClass} for ${academicYear}: ${missing.join(", ")}`,
      );
    }

    const inactiveStudent = academicRecords.find((record) => record.student?.active === false);
    if (inactiveStudent) {
      throw new Error(`Inactive student cannot be promoted: ${inactiveStudent.admissionNo}`);
    }

    const existingTargets = await tx.studentAcademic.findMany({
      where: {
        academicYear: newAcademicYear,
        admissionNo: { in: uniqueAdmissionNos },
      },
      select: { admissionNo: true },
    });

    if (existingTargets.length > 0) {
      throw new Error(
        `Students already enrolled in ${newAcademicYear}: ${existingTargets
          .map((record) => record.admissionNo)
          .join(", ")}`,
      );
    }

    const feeAccountsByAdmissionNo = new Map(
      (
        await tx.studentFeeAccount.findMany({
          where: {
            academicYear,
            admissionNo: { in: uniqueAdmissionNos },
          },
        })
      ).map((record) => [record.admissionNo, record]),
    );

    for (const academicRecord of academicRecords) {
      const admissionNo = academicRecord.admissionNo;
      const sourceFeeAccount = feeAccountsByAdmissionNo.get(admissionNo);

      if (!sourceFeeAccount) {
        throw new Error(`Fee account missing for ${admissionNo} in ${academicYear}`);
      }

      const { netFee, balance } = computeFeeSummary({
        tuitionFee: feeStructure.tuitionFee,
        feeStartMonth: 4,
        transportOpted: academicRecord.transportOpted,
        transportFee: academicRecord.transportFee,
        totalPaid: 0,
        activeDiscount: 0,
      });

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

      await tx.studentAcademic.create({
        data: {
          admissionNo,
          academicYear: newAcademicYear,
          class: newClass,
          section: null,
          feeStartMonth: 4,
          transportOpted: academicRecord.transportOpted,
          transportFee: academicRecord.transportOpted ? academicRecord.transportFee : null,
        },
      });

      await tx.studentFeeAccount.create({
        data: {
          admissionNo,
          academicYear: newAcademicYear,
          totalFee: netFee,
          totalPaid: 0,
          balance,
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
