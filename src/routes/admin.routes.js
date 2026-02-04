import express from "express";
import { createStudent } from "../controllers/admin.controller.js";

import { adminLogin } from "../controllers/auth.controller.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { applyDiscount } from "../controllers/discount.controller.js";

const router = express.Router();

router.post("/discounts", requireAdmin, applyDiscount);

router.post("/login", adminLogin);
router.post("/students", requireAdmin, createStudent);
import { createCashPayment } from "../controllers/payment.controller.js";

router.post("/payments/cash", requireAdmin, createCashPayment);

export default router;
