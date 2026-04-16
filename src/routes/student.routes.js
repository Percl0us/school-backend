import express from "express";
import { studentLogin } from "../controllers/student.controller.js";
import { requireStudent } from "../middlewares/requireStudent.js";
import {
  getAllStudentResults,
  getStudentResultsByYear,
} from "../controllers/result.controller.js";

const router = express.Router();

// Public route
router.post("/login", studentLogin);

// All routes below require student authentication
router.use(requireStudent);

// Results
router.get("/results", getAllStudentResults);
router.get("/results/:academicYear", getStudentResultsByYear);

export default router;