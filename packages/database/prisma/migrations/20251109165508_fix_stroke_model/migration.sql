/*
  Warnings:

  - You are about to drop the column `h` on the `Stroke` table. All the data in the column will be lost.
  - You are about to drop the column `w` on the `Stroke` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Stroke" DROP COLUMN "h",
DROP COLUMN "w",
ADD COLUMN     "height" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "points" JSONB DEFAULT '[]',
ADD COLUMN     "rotation" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "strokeWidth" DOUBLE PRECISION DEFAULT 1,
ADD COLUMN     "width" DOUBLE PRECISION DEFAULT 0;
