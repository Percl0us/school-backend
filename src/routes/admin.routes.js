import express from "express";
import { adminLogin } from "../controllers/auth.controller.js";
import { createStudent } from "../controllers/admin.controller.js";
import { applyDiscount } from "../controllers/discount.controller.js";
import {
  confirmUPIPayment,
  createCashPayment,
  rejectUPIPayment,
} from "../controllers/payment.controller.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = express.Router();

/* =========================
   AUTH
========================= */
import {
  getAcademicYears,
  getFinanceOverview,
  getGlobalFinance,
  getPendingPayments,
} from "../controllers/adminFinance.controller.js";

router.get("/academic-years", requireAdmin, getAcademicYears);
router.post("/login", adminLogin);

/* =========================
   STUDENT MANAGEMENT
========================= */
router.post("/students", requireAdmin, createStudent);

/* =========================
   FINANCIAL ACTIONS
========================= */
router.post("/students/discount", requireAdmin, applyDiscount);
router.post("/payments/cash", requireAdmin, createCashPayment);
import { getStudentFinance } from "../controllers/adminFinance.controller.js";
import { listStudentsBySession } from "../controllers/adminStudent.controller.js";
import { listClassesBySession } from "../controllers/adminStudent.controller.js";
import { promoteStudents } from "../controllers/adminStudent.controller.js";
import uploadCSV from "../middlewares/csvUpload.middleware.js";
import { bulkUploadStudents } from "../controllers/bulkStudent.controller.js";

router.get(
  "/students/:admissionNo/:academicYear/finance",
  requireAdmin,
  getStudentFinance,
);

router.post(
  "/students/bulk-upload",
  requireAdmin,
  uploadCSV.single("file"),
  bulkUploadStudents,
);
router.get("/finance/pending", requireAdmin, getPendingPayments);
router.post("/payments/:paymentId/reject", requireAdmin, rejectUPIPayment);
router.get("/finance", requireAdmin, getGlobalFinance);
router.get("/students", requireAdmin, listStudentsBySession);
router.post("/payments/:paymentId/confirm", requireAdmin, confirmUPIPayment);
router.post("/students/promote", requireAdmin, promoteStudents);
router.get("/classes", requireAdmin, listClassesBySession);
router.get("/finance/overview", requireAdmin, getFinanceOverview);
export default router;
