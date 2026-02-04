import { applyDiscountService } from "../services/discount.service.js";

export const applyDiscount = async (req, res) => {
  try {
    const result = await applyDiscountService(req.body, req.adminId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
