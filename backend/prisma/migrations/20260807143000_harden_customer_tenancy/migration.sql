-- Enforce origin branch ownership at the database boundary as well as in the service.
CREATE UNIQUE INDEX "Branch_id_companyId_key" ON "Branch"("id", "companyId");
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_originBranchId_fkey";
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_originBranchId_companyId_fkey"
  FOREIGN KEY ("originBranchId", "companyId") REFERENCES "Branch"("id", "companyId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
