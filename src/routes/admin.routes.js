
import express from "express";

const router = express.Router();

/* =========================
   IMPORTS
========================= */

// Auth
import { adminLogin } from "../controllers/auth.controller.js";

// Middleware
import { requireAdmin } from "../middlewares/requireAdmin.js";

// Student
import { createStudent } from "../controllers/admin.controller.js";
import {
  listStudentsBySession,
  listClassesBySession,
  promoteStudents,
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

/* =========================
   AUTH
========================= */

router.post("/login", adminLogin);

/* =========================
   STUDENT MANAGEMENT
========================= */

router.post("/students", requireAdmin, createStudent);
router.get("/students", requireAdmin, listStudentsBySession);
router.get("/classes", requireAdmin, listClassesBySession);
router.post("/students/promote", requireAdmin, promoteStudents);

router.post(
  "/students/bulk-upload",
  requireAdmin,
  uploadCSV.single("file"),
  bulkUploadStudents
);

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
  getStudentFinance
);

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
