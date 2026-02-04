import { createOrderService } from "../services/payment.service.js";

import { verifyPaymentService } from "../services/payment.service.js";
export const createOrder = async (req, res) => {
  try {
    const result = await createOrderService(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const result = await verifyPaymentService(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
import { createCashPaymentService } from "../services/payment.service.js";

export const createCashPayment = async (req, res) => {
  try {
    const result = await createCashPaymentService(
      req.body,
      req.adminId
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

