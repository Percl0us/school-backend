-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('ONLINE', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FeeAccountStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "FeeFrequency" AS ENUM ('MONTHLY', 'TERM');

-- CreateTable
CREATE TABLE "Student" (
    "admissionNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("admissionNo")
);

-- CreateTable
CREATE TABLE "StudentAcademic" (
    "id" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "section" TEXT,
    "feeStartMonth" INTEGER NOT NULL,
    "transportOpted" BOOLEAN NOT NULL,

    CONSTRAINT "StudentAcademic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "tuitionFee" INTEGER NOT NULL,
    "transportFee" INTEGER NOT NULL,
    "frequency" "FeeFrequency" NOT NULL,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeAccount" (
    "id" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "totalFee" INTEGER NOT NULL,
    "totalPaid" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL,
    "status" "FeeAccountStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "StudentFeeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "appliedBy" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "receiptNumber" TEXT,
    "monthsCovered" JSONB NOT NULL,
    "collectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentAcademic_admissionNo_academicYear_key" ON "StudentAcademic"("admissionNo", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_academicYear_class_key" ON "FeeStructure"("academicYear", "class");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeAccount_admissionNo_academicYear_key" ON "StudentFeeAccount"("admissionNo", "academicYear");

-- AddForeignKey
ALTER TABLE "StudentAcademic" ADD CONSTRAINT "StudentAcademic_admissionNo_fkey" FOREIGN KEY ("admissionNo") REFERENCES "Student"("admissionNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAccount" ADD CONSTRAINT "StudentFeeAccount_admissionNo_fkey" FOREIGN KEY ("admissionNo") REFERENCES "Student"("admissionNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_admissionNo_fkey" FOREIGN KEY ("admissionNo") REFERENCES "Student"("admissionNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_admissionNo_fkey" FOREIGN KEY ("admissionNo") REFERENCES "Student"("admissionNo") ON DELETE RESTRICT ON UPDATE CASCADE;
