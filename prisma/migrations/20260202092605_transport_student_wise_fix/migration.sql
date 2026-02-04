/*
  Warnings:

  - You are about to drop the column `transportFee` on the `FeeStructure` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FeeStructure" DROP COLUMN "transportFee";

-- AlterTable
ALTER TABLE "StudentAcademic" ADD COLUMN     "transportFee" INTEGER;
