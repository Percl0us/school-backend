import PDFDocument from "pdfkit";
import path from "path";
import { prisma } from "../lib/prisma.js";

const formatMonthsCovered = (monthsCovered) => {
  if (!Array.isArray(monthsCovered) || monthsCovered.length === 0) {
    return "Full outstanding dues";
  }

  return monthsCovered.map((m) => String(m).replace(/\b\w/g, (c) => c.toUpperCase())).join(", ");
};

const formatCurrency = (amount) =>
  `INR ${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatDateTime = (value) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const amountToWords = (amount) => {
  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  const twoDigits = (num) => {
    if (num < 20) return ones[num];
    const ten = Math.floor(num / 10);
    const unit = num % 10;
    return `${tens[ten]}${unit ? ` ${ones[unit]}` : ""}`.trim();
  };

  const threeDigits = (num) => {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    const hundredPart = hundred ? `${ones[hundred]} hundred` : "";
    const remainderPart = remainder ? twoDigits(remainder) : "";
    return `${hundredPart}${hundredPart && remainderPart ? " " : ""}${remainderPart}`.trim();
  };

  const integerAmount = Math.round(Number(amount || 0));

  if (!integerAmount) {
    return "Zero only";
  }

  const crore = Math.floor(integerAmount / 10000000);
  const lakh = Math.floor((integerAmount % 10000000) / 100000);
  const thousand = Math.floor((integerAmount % 100000) / 1000);
  const remainder = integerAmount % 1000;

  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} thousand`);
  if (remainder) parts.push(threeDigits(remainder));

  const words = `${parts.join(" ").replace(/\s+/g, " ").trim()} only`;
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const drawLabeledText = (doc, label, value, x, y, options = {}) => {
  const labelWidth = options.labelWidth ?? 80;
  const valueWidth = options.valueWidth ?? 200;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#475569")
    .text(label, x, y, { width: labelWidth });

  doc
    .font("Helvetica-Bold")
    .fillColor("#0f172a")
    .text(value, x + labelWidth + 8, y, { width: valueWidth });
};

const drawSectionHeading = (doc, title, x, y, width) => {
  doc.roundedRect(x, y, width, 28, 6).fill("#eef2ff");
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1e3a8a")
    .text(title.toUpperCase(), x + 12, y + 8, { width: width - 24 });
};

const drawTableRow = (doc, cols, x, y, heights = 18, opts = {}) => {
  const widths = opts.widths || [260, 120, 120];
  let cx = x;
  cols.forEach((text, i) => {
    doc
      .font(i === cols.length - 1 ? "Helvetica-Bold" : "Helvetica")
      .fontSize(i === cols.length - 1 ? 10 : 9)
      .fillColor("#0f172a")
      .text(text, cx + 6, y + 5, { width: widths[i] - 12, align: i === 1 ? "center" : "left" });
    cx += widths[i];
  });
  // row separator
  doc.moveTo(x, y + heights).lineTo(x + widths.reduce((s, w) => s + w, 0), y + heights).strokeColor("#e2e8f0").stroke();
};

export const generateReceiptPDF = async (paymentId, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found");

  const [student, academic, feeAccount] = await Promise.all([
    prisma.student.findUnique({
      where: { admissionNo: payment.admissionNo },
    }),
    prisma.studentAcademic.findUnique({
      where: {
        admissionNo_academicYear: {
          admissionNo: payment.admissionNo,
          academicYear: payment.academicYear,
        },
      },
    }),
    prisma.studentFeeAccount.findUnique({
      where: {
        admissionNo_academicYear: {
          admissionNo: payment.admissionNo,
          academicYear: payment.academicYear,
        },
      },
    }),
  ]);

  if (!student || !academic || !feeAccount) {
    throw new Error("Receipt data is incomplete");
  }

  const doc = new PDFDocument({ size: "A4", margin: 36 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Receipt_${payment.receiptNumber || payment.id}.pdf"`,
  );
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const contentX = 42;
  const contentWidth = pageWidth - contentX * 2;
  const primary = "#0f172a";
  const secondary = "#475569";
  const muted = "#64748b";
  const border = "#e2e8f0";
  const light = "#fbfdff";
  const accent = "#1e3a8a";
  const success = "#14532d";
  const receiptDate = formatDateTime(payment.createdAt);
  const currentPaid = Number(payment.amount || 0);
  const totalPaidAfter = Number(feeAccount.totalPaid || 0);
  const totalPaidBefore = Math.max(0, totalPaidAfter - currentPaid);
  const paymentReference =
    payment.mode === "UPI"
      ? payment.utrNumber || "Not available"
      : payment.collectedBy || "School Office";

  // Outer border
  doc
    .rect(18, 18, pageWidth - 36, doc.page.height - 36)
    .lineWidth(1)
    .strokeColor("#f1f5f9")
    .stroke();

  // Header block
  doc.roundedRect(contentX, 34, contentWidth, 90, 10).fill("#ffffff").strokeColor(border).stroke();

  const logoPath = path.resolve("assets/school-logo.jpg");
  try {
    doc.image(logoPath, contentX + 14, 46, { width: 64, height: 64 });
  } catch {
    // ignore
  }

  // School title centered vertically in header
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(primary)
    .text("TAGORE PUBLIC SCHOOL", contentX + 96, 48, { continued: false })
    .font("Helvetica")
    .fontSize(10)
    .fillColor(secondary)
    .text("Kalkha, Panipat, Haryana - 132105", contentX + 96, 70)
    .text("Phone: +91 8221017320 | Email: tagorekalkha@gmail.com", contentX + 96, 86);

  // Receipt box on right
  const receiptBoxX = contentX + contentWidth - 180;
  doc
    .roundedRect(receiptBoxX, 46, 160, 66, 8)
    .fill("#eef2ff")
    .strokeColor("#dbeafe")
    .stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(accent)
    .text("RECEIPT", receiptBoxX, 52, { width: 160, align: "center" });

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(primary)
    .text(payment.receiptNumber || payment.id, receiptBoxX, 72, { width: 160, align: "center" });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(secondary)
    .text(formatDate(payment.createdAt), receiptBoxX, 86, { width: 160, align: "center" });

  // Student & Payment sections
  drawSectionHeading(doc, "Student Details", contentX, 142, 300);
  drawSectionHeading(doc, "Payment Details", contentX + 320, 142, 220);

  doc
    .roundedRect(contentX, 170, 300, 110, 8)
    .fill(light)
    .roundedRect(contentX + 320, 170, 220, 110, 8)
    .fill(light)
    .strokeColor(border)
    .stroke();

  drawLabeledText(doc, "Name", student.name || "N/A", contentX + 12, 180, { labelWidth: 60, valueWidth: 220 });
  drawLabeledText(doc, "Adm No", student.admissionNo || "N/A", contentX + 12, 198, { labelWidth: 60, valueWidth: 220 });
  drawLabeledText(doc, "Father", student.fatherName || "N/A", contentX + 12, 216, { labelWidth: 60, valueWidth: 220 });
  drawLabeledText(doc, "Mother", student.motherName || "N/A", contentX + 12, 234, { labelWidth: 60, valueWidth: 220 });

  drawLabeledText(doc, "Session", academic.academicYear || "N/A", contentX + 332, 180, { labelWidth: 68, valueWidth: 140 });
  drawLabeledText(
    doc,
    "Class",
    `${academic.class}${academic.section ? ` - ${academic.section}` : ""}`,
    contentX + 332,
    198,
    { labelWidth: 68, valueWidth: 140 },
  );
  drawLabeledText(doc, "Paid On", receiptDate, contentX + 332, 216, { labelWidth: 68, valueWidth: 140 });
  drawLabeledText(doc, "Mode", payment.mode || "N/A", contentX + 332, 234, { labelWidth: 68, valueWidth: 140 });

  // Fee Description (table-like)
  drawSectionHeading(doc, "Fee Description", contentX, 294, contentWidth);
  const tableY = 322;
  doc
    .roundedRect(contentX, tableY, contentWidth, 110, 8)
    .fill(light)
    .strokeColor(border)
    .stroke();

  // table header
  drawTableRow(doc, ["Description", "Months Covered", "Reference"], contentX + 4, tableY + 2, 24, { widths: [360, 100, 120] });

  // table body (single line for now, can be expanded)
  drawTableRow(
    doc,
    ["Tuition and applicable school fees", formatMonthsCovered(payment.monthsCovered), paymentReference],
    contentX + 4,
    tableY + 26,
    22,
    { widths: [360, 100, 120] },
  );

  // Fee Summary and Notes
  drawSectionHeading(doc, "Fee Summary", contentX, 444, 340);
  drawSectionHeading(doc, "Notes", contentX + 360, 444, contentWidth - 360);

  doc
    .roundedRect(contentX, 472, 340, 140, 8)
    .fill(light)
    .roundedRect(contentX + 360, 472, contentWidth - 360, 140, 8)
    .fill(light);

  // summary rows
  const summaryX = contentX + 8;
  let rowY = 484;
  const summaryRows = [
    ["Total Paid Before This Receipt", formatCurrency(totalPaidBefore)],
    ["Amount Paid Now", formatCurrency(currentPaid)],
    ["Total Paid After This Receipt", formatCurrency(totalPaidAfter)],
  ];

  summaryRows.forEach(([label, value], idx) => {
    doc
      .font(idx === 1 ? "Helvetica-Bold" : "Helvetica")
      .fontSize(idx === 1 ? 11 : 10)
      .fillColor(idx === 1 ? accent : secondary)
      .text(label, summaryX, rowY, { width: 220 })
      .font(idx === 1 ? "Helvetica-Bold" : "Helvetica")
      .fillColor(primary)
      .text(value, summaryX + 220, rowY, { width: 100, align: "right" });

    rowY += idx === 1 ? 26 : 20;
  });

  // amount in words and small notes
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(secondary)
    .text("Amount (in words):", contentX + 360 + 12, 484)
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(primary)
    .text(amountToWords(currentPaid), contentX + 360 + 12, 500, { width: 200 });

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(muted)
    .text("This is a system-generated receipt. Retain for your records.", contentX + 360 + 12, 536, { width: contentWidth - 380 })
    .text("Report any discrepancy to the school accounts within 7 days.", contentX + 360 + 12, 552, { width: contentWidth - 380 });

  // Important information
  drawSectionHeading(doc, "Important Information", contentX, 634, contentWidth);
  doc
    .roundedRect(contentX, 662, contentWidth, 66, 8)
    .fill(light)
    .font("Helvetica")
    .fontSize(8)
    .fillColor(secondary)
    .text(
      "1. This is a system-generated fee receipt and is valid without a physical signature.\n2. Keep this receipt for future reference and fee reconciliation.",
      contentX + 14,
      674,
      { width: contentWidth - 28, lineGap: 4 },
    );

  // Signature lines
  const sigY = 746;
  doc
    .moveTo(contentX + 50, sigY)
    .lineTo(contentX + 200, sigY)
    .strokeColor(border)
    .lineWidth(0.8)
    .stroke();

  doc
    .moveTo(contentX + 340, sigY)
    .lineTo(contentX + 490, sigY)
    .stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(primary)
    .text("Parent / Guardian", contentX + 56, sigY + 6, { width: 140, align: "center" })
    .text("Accounts Officer", contentX + 344, sigY + 6, { width: 140, align: "center" });

  // Footer status and generated timestamp
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(success)
    .text(`Payment status: ${payment.status ? payment.status.toUpperCase() : "CONFIRMED"}`, contentX + 12, doc.page.height - 36 - 18);

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(muted)
    .text(`Generated: ${formatDateTime(new Date())}`, contentX + contentWidth - 150, doc.page.height - 36 - 16, { width: 140, align: "right" });

  doc.end();
};
