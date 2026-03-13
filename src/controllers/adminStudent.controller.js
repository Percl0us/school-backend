import { listStudentsBySessionService } from "../services/adminStudent.service.js";

export const listStudentsBySession = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const result = await listStudentsBySessionService(academicYear);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
import { listClassesBySessionService } from "../services/adminStudent.service.js";

export const listClassesBySession = async (req, res) => {
  try {
    const { academicYear } = req.query;

    if (!academicYear) {
      return res
        .status(400)
        .json({ error: "Academic year required" });
    }

    const result =
      await listClassesBySessionService(academicYear);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
import { promoteStudentsService } from "../services/adminStudent.service.js";

export const promoteStudents = async (req, res) => {
  try {
    const result =
      await promoteStudentsService(req.body);

    res.json(result);
  } catch (err) {
    res.status(400).json({
      error: err.message,
    });
  }
};