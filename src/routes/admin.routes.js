import express from "express";

const router = express.Router();

/* =========================
   IMPORTS
========================= */

// Auth
import { adminLogin } from "../controllers/auth.controller.js";

// Middleware
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { uploadStudentProfile } from "../middlewares/upload.middleware.js";

// Academic Sessions
import {
  createAcademicSession,
  getAllAcademicSessions,
  getActiveAcademicSession,
  updateAcademicSession,
  deleteAcademicSession,
} from "../controllers/academicSession.controller.js";

// Fee Structures
import {
  listFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
} from "../controllers/feeStructure.controller.js";

// Student
import { createStudent } from "../controllers/admin.controller.js";
import {
  deleteStudent,
  getStudentDetail,
  listStudentsBySession,
  listClassesBySession,
  promoteStudents,
  updateStudent,
} from "../controllers/adminStudent.controller.js";

// Finance
import {
  getAcademicYears,
  getFinanceOverview,
  getGlobalFinance,
  getPendingPayments,
  getStudentFinance,
} from "../controllers/adminFinance.controller.js";

// Payments
import {
  confirmUPIPayment,
  createCashPayment,
  rejectUPIPayment,
} from "../controllers/payment.controller.js";

// Discounts
import { applyDiscount } from "../controllers/discount.controller.js";

// Bulk Upload
import uploadCSV from "../middlewares/csvUpload.middleware.js";
import { bulkUploadStudents } from "../controllers/bulkStudent.controller.js";

// Notices
import {
  createNotice,
  getAllNotices,
  toggleNoticeStatus,
} from "../controllers/adminNotice.controller.js";

// Results (NEW)
import {
  createResult,
  getAdminStudentResult,
  updateResult,
  downloadMarksTemplate,
  uploadMarksFileMiddleware,
  validateAndPreviewMarks,
  confirmMarksImport,
} from "../controllers/result.controller.js";

/* =========================
   AUTH
========================= */

router.post("/login", adminLogin);

/* =========================
   ACADEMIC SESSIONS
========================= */

router.post("/sessions", requireAdmin, createAcademicSession);
router.get("/sessions", requireAdmin, getAllAcademicSessions);
router.get("/sessions/active", requireAdmin, getActiveAcademicSession);
router.patch("/sessions/:id", requireAdmin, updateAcademicSession);
router.delete("/sessions/:id", requireAdmin, deleteAcademicSession);

/* =========================
   STUDENT MANAGEMENT
========================= */

router.post(
  "/students",
  requireAdmin,
  uploadStudentProfile.single("profileImage"),
  createStudent,
);
router.get("/students", requireAdmin, listStudentsBySession);
router.get("/students/:admissionNo", requireAdmin, getStudentDetail);
router.patch(
  "/students/:admissionNo",
  requireAdmin,
  uploadStudentProfile.single("profileImage"),
  updateStudent,
);
router.delete("/students/:admissionNo", requireAdmin, deleteStudent);
router.get("/classes", requireAdmin, listClassesBySession);
router.post("/students/promote", requireAdmin, promoteStudents);

router.post(
  "/students/bulk-upload",
  requireAdmin,
  uploadCSV.single("file"),
  bulkUploadStudents,
);

/* =========================
   RESULTS MANAGEMENT (NEW)
========================= */

router.post("/results", requireAdmin, createResult);
router.patch("/results", requireAdmin, updateResult);
router.get("/results/:admissionNo/:academicYear", requireAdmin, getAdminStudentResult);
router.patch("/results/:admissionNo/:academicYear", requireAdmin, updateResult);
router.get(
  "/results/template/:className/:academicYear",
  requireAdmin,
  downloadMarksTemplate,
);
router.post(
  "/results/bulk-upload",
  requireAdmin,
  uploadMarksFileMiddleware,
  validateAndPreviewMarks,
);
router.post("/results/confirm", requireAdmin, confirmMarksImport);

/* =========================
   FINANCE
========================= */

router.get("/academic-years", requireAdmin, getAcademicYears);
router.get("/finance", requireAdmin, getGlobalFinance);
router.get("/finance/overview", requireAdmin, getFinanceOverview);
router.get("/finance/pending", requireAdmin, getPendingPayments);

router.get(
  "/students/:admissionNo/:academicYear/finance",
  requireAdmin,
  getStudentFinance,
);

/* =========================
   FEE STRUCTURES
========================= */

router.get("/fee-structures", requireAdmin, listFeeStructures);
router.post("/fee-structures", requireAdmin, createFeeStructure);
router.patch("/fee-structures/:id", requireAdmin, updateFeeStructure);
router.delete("/fee-structures/:id", requireAdmin, deleteFeeStructure);
/* =========================
   PAYMENTS
========================= */

router.post("/payments/cash", requireAdmin, createCashPayment);
router.post("/payments/:paymentId/confirm", requireAdmin, confirmUPIPayment);
router.post("/payments/:paymentId/reject", requireAdmin, rejectUPIPayment);

/* =========================
   DISCOUNTS
========================= */

router.post("/students/discount", requireAdmin, applyDiscount);

/* =========================
   NOTICE MANAGEMENT
========================= */

router.get("/notices", requireAdmin, getAllNotices);
router.post("/notices", requireAdmin, createNotice);
router.patch("/notices/:id", requireAdmin, toggleNoticeStatus);

export default router;
