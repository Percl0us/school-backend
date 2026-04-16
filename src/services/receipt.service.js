import PDFDocument from "pdfkit";
import path from "path";
import { prisma } from "../lib/prisma.js";

const formatMonthsCovered = (monthsCovered) => {
  if (!Array.isArray(monthsCovered) || monthsCovered.length === 0) {
    return "Full outstanding dues";
  }

  return monthsCovered.join(", ");
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

  return `${parts.join(" ").replace(/\s+/g, " ").trim()} only`
    .replace(/^\w/, (char) => char.toUpperCase());
};

const drawLabeledText = (doc, label, value, x, y, labelWidth = 72) => {
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#64748b")
    .text(label, x, y, { width: labelWidth });

  doc
    .font("Helvetica-Bold")
    .fillColor("#0f172a")
    .text(value, x + labelWidth, y, { width: 180 });
};

const drawSectionHeading = (doc, title, x, y, width) => {
  doc
    .roundedRect(x, y, width, 24, 6)
    .fill("#eff6ff");

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1d4ed8")
    .text(title.toUpperCase(), x + 12, y + 7, { width: width - 24 });
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
    `attachment; filename="Receipt_${payment.receiptNumber}.pdf"`,
  );
  doc.pipe(res);

  const pageWidth = 595.28;
  const contentX = 42;
  const contentWidth = 511;
  const primary = "#0f172a";
  const secondary = "#475569";
  const muted = "#64748b";
  const border = "#cbd5e1";
  const light = "#f8fafc";
  const accent = "#1d4ed8";
  const success = "#14532d";
  const receiptDate = formatDateTime(payment.createdAt);
  const currentPaid = payment.amount;
  const totalPaidAfter = feeAccount.totalPaid;
  const totalPaidBefore = Math.max(0, totalPaidAfter - currentPaid);
  const paymentReference = payment.mode === "UPI"
    ? payment.utrNumber || "Not available"
    : payment.collectedBy || "Collected at school office";

  doc
    .rect(18, 18, pageWidth - 36, 806)
    .lineWidth(1)
    .strokeColor(border)
    .stroke();

  doc
    .roundedRect(contentX, 34, contentWidth, 90, 14)
    .fill("#eff6ff");

  const logoPath = path.resolve("assets/school-logo.jpg");
  try {
    doc.image(logoPath, contentX + 16, 48, { width: 56, height: 56 });
  } catch {
    // no-op if logo is unavailable
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(23)
    .fillColor(primary)
    .text("TAGORE PUBLIC SCHOOL", contentX + 86, 48)
    .font("Helvetica")
    .fontSize(10)
    .fillColor(secondary)
    .text("Academic Fee Payment Receipt", contentX + 86, 76)
    .text("Main Road, City, District, Haryana - 000000", contentX + 86, 91)
    .text("Phone: +91 98765 43210  |  Email: info@tagorepublicschool.edu", contentX + 86, 105);

  doc
    .roundedRect(426, 46, 111, 64, 10)
    .fill("#dbeafe")
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(accent)
    .text("RECEIPT", 426, 58, { width: 111, align: "center" })
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(primary)
    .text(payment.receiptNumber || payment.id, 434, 77, {
      width: 95,
      align: "center",
    })
    .text(formatDate(payment.createdAt), 434, 92, {
      width: 95,
      align: "center",
    });

  drawSectionHeading(doc, "Student Details", contentX, 142, 245);
  drawSectionHeading(doc, "Payment Details", 308, 142, 245);

  doc
    .roundedRect(contentX, 170, 245, 106, 10)
    .fill(light)
    .roundedRect(308, 170, 245, 106, 10)
    .fill(light);

  drawLabeledText(doc, "Name", student.name || "N/A", 56, 184);
  drawLabeledText(doc, "Adm No", student.admissionNo || "N/A", 56, 202);
  drawLabeledText(doc, "Father", student.fatherName || "N/A", 56, 220);
  drawLabeledText(doc, "Mother", student.motherName || "N/A", 56, 238);

  drawLabeledText(doc, "Session", academic.academicYear || "N/A", 320, 184);
  drawLabeledText(
    doc,
    "Class",
    `${academic.class}${academic.section ? ` - ${academic.section}` : ""}`,
    320,
    202,
  );
  drawLabeledText(doc, "Paid On", receiptDate, 320, 220);
  drawLabeledText(doc, "Mode", payment.mode, 320, 238);

  drawSectionHeading(doc, "Fee Description", contentX, 294, contentWidth);
  doc
    .roundedRect(contentX, 322, contentWidth, 88, 10)
    .fill(light)
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(primary)
    .text("Description", 56, 336)
    .text("Covered Months", 300, 336)
    .text("Reference", 430, 336);

  doc
    .moveTo(56, 354)
    .lineTo(539, 354)
    .strokeColor(border)
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(primary)
    .text("Tuition and applicable school fee payment", 56, 366, {
      width: 214,
    })
    .text(formatMonthsCovered(payment.monthsCovered), 300, 366, {
      width: 112,
    })
    .text(paymentReference, 430, 366, {
      width: 109,
    });

  drawSectionHeading(doc, "Fee Summary", contentX, 428, 332);
  drawSectionHeading(doc, "Receipt Notes", 390, 428, 163);

  doc
    .roundedRect(contentX, 456, 332, 172, 10)
    .fill(light)
    .roundedRect(390, 456, 163, 172, 10)
    .fill(light);

  const summaryRows = [
    ["Paid Before This Receipt", formatCurrency(totalPaidBefore)],
    ["Amount Paid Now", formatCurrency(currentPaid)],
  ];

  let rowY = 472;
  summaryRows.forEach(([label, value], index) => {
    if (index === summaryRows.length - 1) {
      doc
        .roundedRect(54, rowY - 6, 308, 28, 8)
        .fill("#dbeafe");
    }

    doc
      .font(index >= 1 ? "Helvetica-Bold" : "Helvetica")
      .fontSize(index === summaryRows.length - 1 ? 10.5 : 9.5)
      .fillColor(index === summaryRows.length - 1 ? accent : secondary)
      .text(label, 62, rowY)
      .fillColor(index === summaryRows.length - 1 ? accent : primary)
      .text(value, 250, rowY, { width: 100, align: "right" });

    rowY += 22;
  });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(secondary)
    .text("Amount in words", 404, 472)
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(primary)
    .text(amountToWords(currentPaid), 404, 490, {
      width: 135,
      align: "left",
    })
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(muted)
    .text("This receipt confirms the payment received against the student's fee account.", 404, 530, {
      width: 135,
      align: "left",
    })
    .text("Please preserve this document for school records and future references.", 404, 560, {
      width: 135,
      align: "left",
    });

  drawSectionHeading(doc, "Important Information", contentX, 626, contentWidth);
  doc
    .roundedRect(contentX, 654, contentWidth, 58, 10)
    .fill(light)
    .font("Helvetica")
    .fontSize(8)
    .fillColor(secondary)
    .text(
      "1. This is a system-generated fee receipt and is valid without a physical signature.",
      56,
      667,
      { width: 470 },
    )
    .text(
      "2. Any discrepancy in payment details should be reported to the school accounts office within 7 days.",
      56,
      683,
      { width: 470 },
    );

  doc
    .moveTo(90, 735)
    .lineTo(190, 735)
    .strokeColor(border)
    .stroke()
    .moveTo(366, 735)
    .lineTo(466, 735)
    .stroke()
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(primary)
    .text("Parent / Guardian", 80, 741, { width: 120, align: "center" })
    .text("Accounts Office", 356, 741, { width: 120, align: "center" });

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(success)
    .text("Payment status: CONFIRMED", 56, 768)
    .font("Helvetica")
    .fillColor(muted)
    .fontSize(7.5)
    .text(`Generated on ${formatDateTime(new Date())}`, 420, 768, {
      width: 110,
      align: "right",
    });

  doc.end();
};
