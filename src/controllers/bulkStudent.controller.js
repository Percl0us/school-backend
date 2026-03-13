import { bulkCreateStudentsService } from "../services/bulkStudent.service.js";

export const bulkUploadStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "CSV file required" });
    }

    const result = await bulkCreateStudentsService(req.file.buffer);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};