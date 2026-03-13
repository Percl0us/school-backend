import { prisma } from "../lib/prisma.js";
import { parse } from "csv-parse/sync";
import { createStudentAtomic } from "./studentCreation.atomic.js";
export const bulkCreateStudentsService = async (fileBuffer) => {
  const csvData = fileBuffer.toString();

  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const results = {
    success: 0,
    failed: [],
  };

  for (const row of records) {
    try {
      await prisma.$transaction(async (tx) => {
        await createStudentAtomic(tx, {
          ...row,
          feeStartMonth: Number(row.feeStartMonth),
          transportOpted: row.transportOpted === "true",
          transportFee: row.transportFee ? Number(row.transportFee) : null,
        });
      });

      results.success++;
    } catch (err) {
      results.failed.push({
        admissionNo: row.admissionNo,
        error: err.message,
      });
    }
  }

  return results;
};
