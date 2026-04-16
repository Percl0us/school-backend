import { prisma } from "../lib/prisma.js";

const calculateGrade = (marks) => {
  if (marks >= 90) return "A+";
  if (marks >= 75) return "A";
  if (marks >= 60) return "B";
  if (marks >= 45) return "C";
  if (marks >= 33) return "D";
  return "F";
};

const normalizeSubjectsPayload = (subjects) => {
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new Error("At least one subject is required");
  }

  return subjects.map((subject, index) => {
    const name = String(subject.name || subject.subject || "").trim();
    const maxMarksValue =
      subject.maxMarks === undefined || subject.maxMarks === null || subject.maxMarks === ""
        ? 100
        : Number(subject.maxMarks);
    const marksRaw = subject.marksObtained ?? subject.marks ?? null;
    const marksObtained =
      marksRaw === "" || marksRaw === undefined || marksRaw === null ? null : Number(marksRaw);
    const grade = String(subject.grade || "").trim();

    if (!name) {
      throw new Error(`Subject name is required for row ${index + 1}`);
    }

    if (!Number.isFinite(maxMarksValue) || maxMarksValue <= 0) {
      throw new Error(`Max marks must be greater than 0 for ${name}`);
    }

    if (marksObtained !== null) {
      if (!Number.isFinite(marksObtained) || marksObtained < 0 || marksObtained > maxMarksValue) {
        throw new Error(`Marks for ${name} must be between 0 and ${maxMarksValue}`);
      }
    }

    return {
      name,
      maxMarks: maxMarksValue,
      marksObtained,
      grade: marksObtained === null ? grade || "AB" : grade || calculateGrade(marksObtained),
    };
  });
};

// ==================== STUDENT ROUTES ====================

// Get all results for logged‑in student (from token)
export const getAllStudentResults = async (req, res) => {
  try {
    const { admissionNo } = req.user; // from requireStudent middleware

    const results = await prisma.result.findMany({
      where: { admissionNo },
      orderBy: { academicYear: "desc" },
    });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch results" });
  }
};

// Get result for a specific academic year (student)
export const getStudentResultsByYear = async (req, res) => {
  try {
    const { admissionNo } = req.user;
    const { academicYear } = req.params;

    const result = await prisma.result.findUnique({
      where: {
        admissionNo_academicYear: {
          admissionNo,
          academicYear,
        },
      },
    });

    if (!result) {
      return res.status(404).json({ error: "Results not found for this year" });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch results" });
  }
};

// ==================== ADMIN ROUTES ====================

// Admin: create a result
export const createResult = async (req, res) => {
  try {
    const { admissionNo, academicYear } = req.body;
    const subjects = normalizeSubjectsPayload(req.body.subjects);

    if (!admissionNo || !academicYear) {
      return res.status(400).json({ error: "Admission number and academic year are required" });
    }

    const student = await prisma.student.findUnique({
      where: { admissionNo },
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const existing = await prisma.result.findUnique({
      where: {
        admissionNo_academicYear: {
          admissionNo,
          academicYear,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: "Result already exists for this year. Use update instead.",
      });
    }

    const result = await prisma.result.create({
      data: {
        admissionNo,
        academicYear,
        subjects, // JSON field: array of { subject, marks, grade }
      },
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(err.message ? 400 : 500).json({ error: err.message || "Failed to create result" });
  }
};

// Admin: update a result (using query params: ?admissionNo=...&academicYear=...)
export const updateResult = async (req, res) => {
  try {
    const admissionNo = req.params.admissionNo || req.query.admissionNo;
    const academicYear = req.params.academicYear || req.query.academicYear;
    const subjects = normalizeSubjectsPayload(req.body.subjects);

    if (!admissionNo || !academicYear) {
      return res
        .status(400)
        .json({ error: "Missing admissionNo or academicYear" });
    }

    const result = await prisma.result.update({
      where: {
        admissionNo_academicYear: {
          admissionNo,
          academicYear,
        },
      },
      data: { subjects },
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.message?.includes("required") || err.message?.includes("Marks") || err.message?.includes("Subject")
      ? 400
      : 500).json({ error: err.message || "Failed to update result" });
  }
};

export const getAdminStudentResult = async (req, res) => {
  try {
    const { admissionNo, academicYear } = req.params;

    if (!admissionNo || !academicYear) {
      return res.status(400).json({ error: "Admission number and academic year are required" });
    }

    const [student, academic, feeStructure, result] = await Promise.all([
      prisma.student.findUnique({ where: { admissionNo } }),
      prisma.studentAcademic.findUnique({
        where: {
          admissionNo_academicYear: { admissionNo, academicYear },
        },
      }),
      prisma.studentAcademic
        .findUnique({
          where: {
            admissionNo_academicYear: { admissionNo, academicYear },
          },
        })
        .then((academicRecord) => {
          if (!academicRecord) return null;
          return prisma.feeStructure.findUnique({
            where: {
              academicYear_class: {
                academicYear,
                class: academicRecord.class,
              },
            },
          });
        }),
      prisma.result.findUnique({
        where: {
          admissionNo_academicYear: { admissionNo, academicYear },
        },
      }),
    ]);

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (!academic) {
      return res.status(404).json({ error: "Student is not enrolled in this academic year" });
    }

    const definedSubjects = Array.isArray(feeStructure?.subjects) ? feeStructure.subjects : [];
    const subjects =
      result?.subjects && Array.isArray(result.subjects) && result.subjects.length > 0
        ? result.subjects
        : definedSubjects.map((name) => ({
            name,
            maxMarks: 100,
            marksObtained: null,
            grade: "AB",
          }));

    res.json({
      admissionNo,
      academicYear,
      class: academic.class,
      studentName: student.name,
      resultExists: Boolean(result),
      subjects,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch result" });
  }
};
// Add this function to your existing result.controller.js

// Download marks upload template for a specific class & academic year
import ExcelJS from "exceljs";

export const downloadMarksTemplate = async (req, res) => {
  try {
    const { className, academicYear } = req.params;

    // Fetch fee structure to get subjects
    const feeStructure = await prisma.feeStructure.findUnique({
      where: { academicYear_class: { academicYear, class: className } },
    });
    if (!feeStructure) {
      return res
        .status(404)
        .json({ error: "Fee structure not found for this class/year" });
    }

    let subjects = feeStructure.subjects;
    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({
        error:
          "No subjects defined for this fee structure. Please update fee structure to add subjects.",
      });
    }

    // Fetch students enrolled in this class & year
    const students = await prisma.studentAcademic.findMany({
      where: { class: className, academicYear },
      include: { student: true },
      orderBy: { student: { name: "asc" } },
    });

    if (students.length === 0) {
      return res
        .status(404)
        .json({ error: "No students found for this class and year" });
    }

    // Generate Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Marks");
    worksheet.columns = [
      { header: "Admission No", key: "admissionNo", width: 15 },
      { header: "Student Name", key: "name", width: 25 },
      ...subjects.map((s) => ({
        header: s,
        key: s.replace(/\s/g, ""),
        width: 15,
      })),
    ];
    for (const enrollment of students) {
      const row = {
        admissionNo: enrollment.admissionNo,
        name: enrollment.student.name,
      };
      subjects.forEach((s) => {
        row[s.replace(/\s/g, "")] = "";
      });
      worksheet.addRow(row);
    }
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=marks_template_${className}_${academicYear}.xlsx`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate template" });
  }
};
// Get distinct classes for a given academic year (from StudentAcademic or FeeStructure)
export const getClassesByAcademicYear = async (req, res) => {
  try {
    const { academicYear } = req.query;
    if (!academicYear) {
      return res.status(400).json({ error: "academicYear is required" });
    }

    // Option 1: Fetch from FeeStructure (if every class has a fee structure)
    const feeStructures = await prisma.feeStructure.findMany({
      where: { academicYear },
      select: { class: true },
      distinct: ["class"],
      orderBy: { class: "asc" },
    });
    const classes = feeStructures.map((fs) => fs.class);

    // Option 2: If FeeStructure might be missing for some classes, fallback to StudentAcademic
    // (uncomment if needed)
    // if (classes.length === 0) {
    //   const academics = await prisma.studentAcademic.findMany({
    //     where: { academicYear },
    //     select: { class: true },
    //     distinct: ["class"],
    //     orderBy: { class: "asc" },
    //   });
    //   classes = academics.map(a => a.class);
    // }

    res.json(classes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch classes" });
  }
};
// In result.controller.js – add or replace the existing function

import multer from "multer";
import { parse } from "csv-parse/sync";

const storage = multer.memoryStorage();
export const uploadMarksFileMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("file");

export const validateAndPreviewMarks = async (req, res) => {
  try {
    const { className, academicYear } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "No file uploaded" });
    if (!className || !academicYear)
      return res.status(400).json({ error: "Missing class or academic year" });

    // 1. Fetch fee structure to get subject list
    const feeStructure = await prisma.feeStructure.findUnique({
      where: { academicYear_class: { academicYear, class: className } },
    });
    if (!feeStructure) {
      return res
        .status(404)
        .json({ error: "Fee structure not found for this class/year" });
    }
    let subjects = feeStructure.subjects;
    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({
        error:
          "No subjects defined for this fee structure. Please update fee structure first.",
      });
    }

    // 2. Parse file (Excel or CSV)
    let rows = [];
    if (
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      const worksheet = workbook.getWorksheet(1);
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const rowData = row.values.slice(1); // remove index column
        rows.push(rowData);
      });
    } else if (file.mimetype === "text/csv") {
      const content = file.buffer.toString("utf-8");
      rows = parse(content, { columns: false, skip_empty_lines: true });
      rows.shift(); // remove header
    } else {
      return res
        .status(400)
        .json({ error: "Only .xlsx or .csv files allowed" });
    }

    // 3. Fetch students in this class/year for validation
    const students = await prisma.studentAcademic.findMany({
      where: { class: className, academicYear },
      include: { student: true },
    });
    const studentMap = new Map(
      students.map((s) => [s.admissionNo, s.student.name]),
    );

    const validRows = [];
    const invalidRows = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const admissionNo = row[0]?.toString().trim();
      const studentName = row[1]?.toString().trim();
      const marks = row.slice(2); // remaining columns = marks for each subject

      // Check column count
      if (marks.length !== subjects.length) {
        invalidRows.push({
          rowNumber: idx + 2,
          error: `Expected ${subjects.length} subject columns, got ${marks.length}`,
        });
        continue;
      }

      // Validate admissionNo and name
      if (!admissionNo || !studentName) {
        invalidRows.push({
          rowNumber: idx + 2,
          error: "Missing admission number or student name",
        });
        continue;
      }
      if (!studentMap.has(admissionNo)) {
        invalidRows.push({
          rowNumber: idx + 2,
          error: "Admission number not found in this class",
        });
        continue;
      }
      if (studentMap.get(admissionNo) !== studentName) {
        invalidRows.push({
          rowNumber: idx + 2,
          error: "Student name does not match",
        });
        continue;
      }

      // Validate marks (0-100 or empty)
      let marksValid = true;
      for (let m of marks) {
        if (m === "" || m === null) continue;
        const num = Number(m);
        if (isNaN(num) || num < 0 || num > 100) {
          marksValid = false;
          break;
        }
      }
      if (!marksValid) {
        invalidRows.push({
          rowNumber: idx + 2,
          error: "Marks must be numbers between 0 and 100 (empty allowed)",
        });
        continue;
      }

      // Convert empty strings to null
      const processedMarks = marks.map((m) =>
        m === "" || m === null ? null : Number(m),
      );

      validRows.push({
        admissionNo,
        studentName,
        marks: processedMarks,
      });
    }

    res.json({
      success: true,
      validRows,
      invalidRows,
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      subjects, // return subject list for preview
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to validate file" });
  }
};
// In result.controller.js – add or replace

export const confirmMarksImport = async (req, res) => {
  try {
    const { data, academicYear, className } = req.body; // need className to fetch fee structure

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "No valid data to import" });
    }
    if (!academicYear || !className) {
      return res
        .status(400)
        .json({ error: "Missing academicYear or className" });
    }

    // Fetch fee structure to get subjects (must exist)
    const feeStructure = await prisma.feeStructure.findUnique({
      where: { academicYear_class: { academicYear, class: className } },
    });
    if (!feeStructure) {
      return res
        .status(404)
        .json({ error: "Fee structure not found for this class/year" });
    }
    const subjects = feeStructure.subjects;
    if (!subjects || subjects.length === 0) {
      return res
        .status(400)
        .json({ error: "No subjects defined for this class/year" });
    }

    const results = [];

    for (const studentData of data) {
      const { admissionNo, marks } = studentData;

      // Build subject results array
      const subjectResults = subjects.map((subjectName, idx) => {
        const marksObtained = marks[idx] !== null ? marks[idx] : null;
        return {
          name: subjectName,
          marksObtained,
          maxMarks: 100,
          grade: marksObtained !== null ? calculateGrade(marksObtained) : "AB",
        };
      });

      // Upsert into Result table
      const result = await prisma.result.upsert({
        where: {
          admissionNo_academicYear: {
            admissionNo,
            academicYear,
          },
        },
        update: {
          subjects: subjectResults,
        },
        create: {
          admissionNo,
          academicYear,
          subjects: subjectResults,
        },
      });
      results.push(result);
    }

    res.json({
      success: true,
      message: `Successfully imported marks for ${results.length} students`,
      summary: { total: results.length },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save marks" });
  }
};

