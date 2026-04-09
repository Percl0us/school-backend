import {
  getAllNoticesService,
  createNoticeService,
  toggleNoticeService,
} from "../services/notice.service.js";

export const getAllNotices = async (req, res) => {
  try {
    const notices = await getAllNoticesService();

    res.json({
      success: true,
      data: notices,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createNotice = async (req, res) => {
  try {
    const { title, date, type } = req.body;

    console.log("BODY:", req.body); // 👈 add this

    if (!title || !date || !type) {
      return res.status(400).json({
        error: "All fields are required",
      });
    }

    const parsedDate = new Date(date);

    const notice = await createNoticeService({
      title,
      date: parsedDate,
      type: type.toUpperCase(),
    });

    res.json({
      success: true,
      data: notice,
    });
  } catch (err) {
    console.error("CREATE NOTICE ERROR:", err); // 👈 THIS LINE

    res.status(500).json({
      error: err.message,
    });
  }
};

export const toggleNoticeStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await toggleNoticeService(id);

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};
