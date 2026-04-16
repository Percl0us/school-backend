-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "subjects" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Result_admissionNo_academicYear_key" ON "Result"("admissionNo", "academicYear");

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_admissionNo_fkey" FOREIGN KEY ("admissionNo") REFERENCES "Student"("admissionNo") ON DELETE RESTRICT ON UPDATE CASCADE;
