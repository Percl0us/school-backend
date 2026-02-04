import express from "express";
import { createOrder } from "../controllers/payment.controller.js";
import { verifyPayment } from "../controllers/payment.controller.js";

import { getReceipt } from "../controllers/receipt.controller.js";
const   router = express.Router();

router.post("/create-order", createOrder);

router.post("/verify", verifyPayment);

router.get("/:paymentId/receipt", getReceipt);

export default router;
