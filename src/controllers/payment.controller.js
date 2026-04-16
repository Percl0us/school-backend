import {
  submitPaymentProofService,
  confirmUPIPaymentService,
  createCashPaymentService,
  rejectUPIPaymentService,
} from "../services/payment.service.js";

/* =========================
   CREATE QR PAYMENT (Student)
========================= */
import { quotePaymentService } from "../services/payment.service.js";

export const quotePayment = async (req, res) => {
  try {
    const result = await quotePaymentService({
      ...req.body,
      admissionNo: req.user.admissionNo,
      academicYear: req.user.academicYear,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* =========================
   SUBMIT UPI PROOF (Student)
========================= */
export const submitPaymentProof = async (req, res) => {
  try {
    const screenshotUrl = req.file?.path;

    if (!screenshotUrl) {
      return res.status(400).json({ error: "Screenshot required" });
    }

    const result = await submitPaymentProofService(
      {
        ...req.body,
        admissionNo: req.user.admissionNo,
        academicYear: req.user.academicYear,
      },
      screenshotUrl,
    );

    res.json({
      message: "Payment submitted for verification",
      payment: result,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* =========================
   ADMIN CONFIRM UPI PAYMENT
========================= */
export const confirmUPIPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const adminId = req.admin.id;

    const result = await confirmUPIPaymentService(paymentId, adminId);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* =========================
   CREATE CASH PAYMENT (Admin)
========================= */
export const createCashPayment = async (req, res) => {
  try {
    const result = await createCashPaymentService(req.body, req.admin.id);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
//reject
export const rejectUPIPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const result = await rejectUPIPaymentService(paymentId, req.admin.id);

    res.json(result);
  } catch (err) {
    res.status(400).json({
      error: err.message,
    });
  }
};
