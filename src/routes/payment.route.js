import express from "express";
import {
  quotePayment,
  submitPaymentProof,
} from "../controllers/payment.controller.js";
import upload from "../middlewares/upload.middleware.js";
import { getReceipt } from "../controllers/receipt.controller.js";
import { requireStudent } from "../middlewares/requireStudent.js";

const router = express.Router();

router.get("/:paymentId/receipt", getReceipt);
router.post("/quote", requireStudent, quotePayment);
router.post(
  "/submit-proof",
  requireStudent,
  upload.single("screenshot"),
  submitPaymentProof,
);
export default router;
