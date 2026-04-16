import { prisma } from "../lib/prisma.js";

export const listFeeStructures = async (req, res) => {
  try {
    const { academicYear } = req.query;

    if (!academicYear) {
      return res.status(400).json({ error: "Academic year is required" });
    }

    const structures = await prisma.feeStructure.findMany({
      where: { academicYear },
      orderBy: { class: "asc" },
    });

    res.json({ structures });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch fee structures" });
  }
};
// Create fee structure
export const createFeeStructure = async (req, res) => {
  try {
    const {
      academicYear,
      class: className,
      tuitionFee,
      frequency,
      subjects,
    } = req.body;

    // Validate subjects is an array (optional, but recommended)
    if (subjects && !Array.isArray(subjects)) {
      return res
        .status(400)
        .json({ error: "subjects must be an array of strings" });
    }

    const feeStructure = await prisma.feeStructure.create({
      data: {
        academicYear,
        class: className,
        tuitionFee,
        frequency,
        subjects: subjects || [], // store as JSON array
      },
    });
    res.status(201).json(feeStructure);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create fee structure" });
  }
};

// Update fee structure
export const updateFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const { tuitionFee, frequency, subjects } = req.body;

    if (subjects !== undefined && !Array.isArray(subjects)) {
      return res
        .status(400)
        .json({ error: "subjects must be an array of strings" });
    }

    const feeStructure = await prisma.feeStructure.update({
      where: { id },
      data: {
        ...(tuitionFee !== undefined ? { tuitionFee } : {}),
        ...(frequency !== undefined ? { frequency } : {}),
        ...(subjects !== undefined ? { subjects } : {}),
      },
    });
    res.json(feeStructure);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update fee structure" });
  }
};

// Also update listFeeStructures to include subjects (no change needed, it already returns all fields)

export const deleteFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.feeStructure.delete({
      where: { id },
    });

    res.json({ message: "Fee structure deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete fee structure" });
  }
};
