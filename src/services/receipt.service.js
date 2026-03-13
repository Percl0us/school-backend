import PDFDocument from "pdfkit";
import path from "path";
import { prisma } from "../lib/prisma.js";

export const generateReceiptPDF = async (paymentId, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found");

  const student = await prisma.student.findUnique({ where: { admissionNo: payment.admissionNo } });
  const academic = await prisma.studentAcademic.findUnique({
    where: {
      admissionNo_academicYear: {
        admissionNo: payment.admissionNo,
        academicYear: payment.academicYear,
      },
    },
  });

  // 1. PDF Setup
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Receipt_${payment.receiptNumber}.pdf"`);
  doc.pipe(res);

  // --- Design Constants ---
  const PRIMARY_COLOR = "#1e293b";
  const SECONDARY_COLOR = "#64748b";
  const BORDER_COLOR = "#e2e8f0";
  const ACCENT_COLOR = "#2563eb";

  // --- Helper: Currency Formatter (Fixed Symbol) ---
  const formatCurrency = (amt) => `INR ${amt.toLocaleString("en-IN")}.00`;

  /* =========================
      BACKGROUND FRAME
  ========================= */
  doc.rect(20, 20, 555, 800).lineWidth(1).strokeColor(BORDER_COLOR).stroke();

  /* =========================
      HEADER & BRANDING
  ========================= */
  const logoPath = path.resolve("assets/school-logo.jpg");
  try {
    doc.image(logoPath, 50, 45, { width: 60 });
  } catch (e) { /* fallback */ }

  doc
    .fillColor(PRIMARY_COLOR)
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("TAGORE PUBLIC SCHOOL", 125, 50)
    .fontSize(10)
    .font("Helvetica")
    .fillColor(SECONDARY_COLOR)
    .text("Affiliated to HBSE | School Code: 12345", 125, 78)
    .text("Main Road, City, District, PIN-000000", 125, 92)
    .text("Contact: +91 98765 43210 | Email: info@tps.com", 125, 106);

  // Receipt Identifier (Top Right)
  doc
    .rect(420, 45, 125, 65)
    .fill("#f1f5f9")
    .fillColor(PRIMARY_COLOR)
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("FEE RECEIPT", 420, 55, { align: "center", width: 125 })
    .moveDown(0.5)
    .fontSize(9)
    .font("Helvetica")
    .text(`No: ${payment.receiptNumber}`, { align: "center" })
    .text(new Date(payment.createdAt).toLocaleDateString("en-IN"), { align: "center" });

  /* =========================
      STUDENT INFO BOX
  ========================= */
  const boxTop = 150;
  doc.rect(50, boxTop, 495, 75).fill("#f8fafc");
  
  doc
    .fillColor(PRIMARY_COLOR)
    .fontSize(9)
    .font("Helvetica-Bold").text("STUDENT INFORMATION", 65, boxTop + 12)
    .font("Helvetica-Bold").text("ACADEMIC DETAILS", 315, boxTop + 12);

  doc.moveTo(65, boxTop + 25).lineTo(530, boxTop + 25).strokeColor(BORDER_COLOR).stroke();

  // Grid Data
  const gridY = boxTop + 35;
  doc
    .font("Helvetica").fillColor(SECONDARY_COLOR).text("Name:", 65, gridY)
    .font("Helvetica-Bold").fillColor(PRIMARY_COLOR).text(student.name.toUpperCase(), 130, gridY)
    
    .font("Helvetica").fillColor(SECONDARY_COLOR).text("Adm No:", 65, gridY + 15)
    .font("Helvetica-Bold").fillColor(PRIMARY_COLOR).text(student.admissionNo, 130, gridY + 15)
    
    .font("Helvetica").fillColor(SECONDARY_COLOR).text("Father:", 65, gridY + 30)
    .font("Helvetica-Bold").fillColor(PRIMARY_COLOR).text(student.fatherName || "N/A", 130, gridY + 30)

    .font("Helvetica").fillColor(SECONDARY_COLOR).text("Class/Sec:", 315, gridY)
    .font("Helvetica-Bold").fillColor(PRIMARY_COLOR).text(`${academic.class} - ${academic.section || 'N/A'}`, 385, gridY)
    
    .font("Helvetica").fillColor(SECONDARY_COLOR).text("Session:", 315, gridY + 15)
    .font("Helvetica-Bold").fillColor(PRIMARY_COLOR).text(academic.academicYear, 385, gridY + 15);

  /* =========================
      PAYMENT TABLE
  ========================= */
  const tableTop = 260;
  
  // Table Header
  doc
    .rect(50, tableTop, 495, 25)
    .fill(PRIMARY_COLOR);

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("DESCRIPTION", 65, tableTop + 8)
    .text("MODE", 350, tableTop + 8)
    .text("AMOUNT", 450, tableTop + 8, { align: "right", width: 80 });

  // Table Body
  const rowY = tableTop + 35;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formattedMonths = payment.monthsCovered?.map(m => months[m-1]).join(", ");

  doc
    .fillColor(PRIMARY_COLOR)
    .font("Helvetica")
    .fontSize(10)
    .text(`School Fees for: ${formattedMonths || 'Current Session'}`, 65, rowY, { width: 270 })
    .text(payment.mode, 350, rowY)
    .font("Helvetica-Bold")
    .text(formatCurrency(payment.amount), 450, rowY, { align: "right", width: 80 });

  // Border below data
  doc.moveTo(50, rowY + 30).lineTo(545, rowY + 30).strokeColor(BORDER_COLOR).stroke();

  // Summary
  const summaryY = rowY + 50;
  doc
    .fontSize(10)
    .fillColor(SECONDARY_COLOR)
    .text("SUB TOTAL", 350, summaryY)
    .text(formatCurrency(payment.amount), 450, summaryY, { align: "right", width: 80 })
    
    .moveDown(0.5)
    .fontSize(12)
    .fillColor(ACCENT_COLOR)
    .font("Helvetica-Bold")
    .text("TOTAL PAID", 350, doc.y)
    .text(formatCurrency(payment.amount), 450, doc.y - 12, { align: "right", width: 80 });

  /* =========================
      FOOTER SECTION
  ========================= */
  const footerY = 650;

  // Amount in words placeholder (optional logic)
  doc
    .fillColor(SECONDARY_COLOR)
    .fontSize(8)
    .font("Helvetica-Oblique")
    .text("Note: Any discrepancy should be reported within 7 days.", 50, footerY);

  // Signatures
  doc
    .lineWidth(0.5)
    .dash(2, { space: 2 })
    .moveTo(70, footerY + 80).lineTo(180, footerY + 80).stroke()
    .moveTo(380, footerY + 80).lineTo(500, footerY + 80).stroke()
    .undash()
    .fontSize(9)
    .fillColor(PRIMARY_COLOR)
    .font("Helvetica-Bold")
    .text("Parent's Signature", 70, footerY + 85, { width: 110, align: "center" })
    .text("Accounts Office", 380, footerY + 85, { width: 120, align: "center" });

  doc
    .fontSize(8)
    .fillColor(SECONDARY_COLOR)
    .font("Helvetica")
    .text("This is an electronically generated receipt, no physical signature is required.", 50, 780, { align: "center", width: 495 });

  doc.end();
};