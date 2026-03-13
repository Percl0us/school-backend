import express from "express";
import {
  quotePayment,
  submitPaymentProof,
} from "../controllers/payment.controller.js";
import upload from "../middlewares/upload.middleware.js";
import { getReceipt } from "../controllers/receipt.controller.js";

const router = express.Router();

router.post("/quote", quotePayment);
router.post("/submit-proof", upload.single("screenshot"), submitPaymentProof);
router.get("/:paymentId/receipt", getReceipt);
export default router;
