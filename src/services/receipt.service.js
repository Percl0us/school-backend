import PDFDocument from "pdfkit";
import path from "path";
import { prisma } from "../lib/prisma.js";

export const generateReceiptPDF = async (paymentId, res) => {
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

  const doc = new PDFDocument({ margin: 50 });

  // ✅ FORCE FILE DOWNLOAD
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="receipt-${payment.receiptNumber}.pdf"`
  );

  doc.pipe(res);

  /* =========================
     HEADER
  ========================= */

  const logoPath = path.resolve("assets/school-logo.jpg");

  try {
    doc.image(logoPath, 50, 40, { width: 60 });
  } catch {}

  doc
    .fontSize(16)
    .text("Tagore Public School", 120, 45)
    .fontSize(10)
    .text("Affiliated to HBSE", 120, 65)
    .text("City, State - PIN", 120, 80);

  doc.moveDown(3);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(2);

  doc.fontSize(14).text("Fee Receipt", { align: "center" });
  doc.moveDown(2);

  doc.fontSize(10);
  doc.text(`Receipt No: ${payment.receiptNumber}`);
  doc.text(`Date: ${new Date(payment.createdAt).toLocaleDateString()}`);
  doc.text(`Payment Mode: ${payment.mode}`);
  doc.text(`Amount Paid: Rs.${payment.amount}`);

  if (payment.monthsCovered?.length > 0) {
    doc.text(`Months Covered: ${payment.monthsCovered.join(", ")}`);
  }

  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(2);

  doc.text(`Student Name: ${student.name}`);
  doc.text(`Admission No: ${student.admissionNo}`);
  doc.text(
    `Class: ${academic.class}${academic.section ? `-${academic.section}` : ""}`
  );
  doc.text(`Academic Year: ${academic.academicYear}`);

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

  doc.moveDown(4);
  doc.fontSize(9).fillColor("gray");
  doc.text(
    "This is a system-generated receipt and does not require a signature."
  );
  doc.moveDown(2);
  doc.text("Authorized Signatory", { align: "right" });

  doc.end();
};
