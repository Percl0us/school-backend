import PDFDocument from "pdfkit";
import path from "path";
import { prisma } from "../lib/prisma.js";

export const generateReceiptPDF = async (paymentId, res) => {
  // 1️⃣ Fetch payment
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  const student = await prisma.student.findUnique({
    where: { admissionNo: payment.admissionNo },
  });

  const academic = await prisma.studentAcademic.findUnique({
    where: {
      admissionNo_academicYear: {
        admissionNo: payment.admissionNo,
        academicYear: payment.academicYear,
      },
    },
  });

  // 2️⃣ Prepare PDF
  const doc = new PDFDocument({ margin: 50 });

  /* =========================
     RESPONSE HEADERS (IMPORTANT)
  ========================= */

  // Force download
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="receipt-${payment.receiptNumber}.pdf"`
  );

  // ✅ Silence CSP + script warnings (PDF-safe)
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");

  doc.pipe(res);

  /* =========================
     HEADER
  ========================= */

  const logoPath = path.resolve("assets/school-logo.jpg");

  try {
    doc.image(logoPath, 50, 40, { width: 60 });
  } catch {
    // logo optional
  }

  doc
    .fontSize(16)
    .text("Tagore Public School", 120, 45)
    .fontSize(10)
    .text("Affiliated to HBSE", 120, 65)
    .text("City, State - PIN", 120, 80);

  doc.moveDown(3);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(2);

  /* =========================
     RECEIPT TITLE
  ========================= */

  doc.fontSize(14).text("Fee Receipt", { align: "center" });
  doc.moveDown(2);

  /* =========================
     RECEIPT DETAILS
  ========================= */

  doc.fontSize(10);
  doc.text(`Receipt No: ${payment.receiptNumber}`);
  doc.text(`Date: ${new Date(payment.createdAt).toLocaleDateString()}`);
  doc.text(`Payment Mode: ${payment.mode}`);
  doc.text(`Amount Paid: ₹${payment.amount}`);

  if (payment.monthsCovered?.length > 0) {
    doc.text(`Months Covered: ${payment.monthsCovered.join(", ")}`);
  }

  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(2);

  /* =========================
     STUDENT DETAILS
  ========================= */

  doc.text(`Student Name: ${student.name}`);
  doc.text(`Admission No: ${student.admissionNo}`);
  doc.text(
    `Class: ${academic.class}${academic.section ? `-${academic.section}` : ""}`
  );
  doc.text(`Academic Year: ${academic.academicYear}`);

  /* =========================
     CASH WATERMARK
  ========================= */

  if (payment.mode === "CASH") {
    doc
      .save()
      .rotate(-30, { origin: [300, 300] })
      .fontSize(40)
      .fillColor("gray", 0.3)
      .text("CASH PAYMENT", 100, 300, {
        align: "center",
        width: 400,
      })
      .restore();
  }

  /* =========================
     FOOTER
  ========================= */

  doc.moveDown(4);
  doc.fontSize(9).fillColor("gray");
  doc.text(
    "This is a system-generated receipt and does not require a signature."
  );

  doc.moveDown(2);
  doc.text("Authorized Signatory", { align: "right" });

  // 3️⃣ Finalize
  doc.end();
};
