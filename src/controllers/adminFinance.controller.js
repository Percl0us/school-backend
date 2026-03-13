import {
  getStudentFinanceService,
  getGlobalFinanceService,
  getAcademicYearsService,
} from "../services/adminFinance.service.js";
export const getStudentFinance = async (req, res) => {
  try {
    const { admissionNo, academicYear } = req.params;

    const result = await getStudentFinanceService(admissionNo, academicYear);

    res.json(result);
  } catch (err) {
    res.status(400).json({
      error: err.message,
    });
  }
};
export const getGlobalFinance = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const result = await getGlobalFinanceService(academicYear);

    res.json(result);
  } catch (err) {
    res.status(400).json({
      error: err.message,
    });
  }
};
export const getAcademicYears = async (req, res) => {
  try {
    const result = await getAcademicYearsService();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
import { getPendingPaymentsService } from "../services/adminFinance.service.js";

export const getPendingPayments = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const result = await getPendingPaymentsService(academicYear);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
import { getFinanceOverviewService } from "../services/adminFinance.service.js";

export const getFinanceOverview = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const result = await getFinanceOverviewService(academicYear);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
