import { createStudentService } from "../services/student.service.js";

export const createStudent = async (req, res) => {
  try {
    const student = await createStudentService(req.body);
    res.status(201).json(student);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};
