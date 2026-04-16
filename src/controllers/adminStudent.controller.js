import {
  deleteStudentService,
  getStudentDetailService,
  listClassesBySessionService,
  listStudentsBySessionService,
  promoteStudentsService,
  updateStudentService,
} from "../services/adminStudent.service.js";

export const listStudentsBySession = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const result = await listStudentsBySessionService(academicYear);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getStudentDetail = async (req, res) => {
  try {
    const { admissionNo } = req.params;
    const { academicYear } = req.query;

    const result = await getStudentDetailService(admissionNo, academicYear);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { admissionNo } = req.params;
    const result = await updateStudentService(admissionNo, {
      ...req.body,
      profileImageUrl: req.file?.path,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { admissionNo } = req.params;
    const result = await deleteStudentService(admissionNo);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

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
