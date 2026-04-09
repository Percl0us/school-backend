import { getNoticesService } from "../services/getNotices.service.js";

export const getNotices = async (req, res) => {
  try {
    const result = await getNoticesService();

    res.json({
      message: "Notices fetched successfully",
      notices: result,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to fetch notices",
    });
  }
};