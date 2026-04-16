import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../lib/cloudinary.js";

// Storage for payment receipts
const paymentsStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "school-payments",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

// Storage for daily challenge submissions
const challengeStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "daily-challenge",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }], // Resize to max 800x800
  },
});

// Storage for student profile photos
const studentProfileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "student-profiles",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 600, height: 600, crop: "limit" }],
  },
});

// Export both middlewares
export const uploadPayment = multer({ storage: paymentsStorage });
export const upload = multer({ storage: challengeStorage });
export const uploadStudentProfile = multer({ storage: studentProfileStorage });

// Keep default export for backward compatibility (payments)
export default multer({ storage: paymentsStorage });
