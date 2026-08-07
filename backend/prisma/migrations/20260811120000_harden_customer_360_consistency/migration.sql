ALTER TABLE "CustomerConsent" ADD COLUMN "operationKey" VARCHAR(120);

UPDATE "CustomerContact"
SET "isActive" = false, "isPrimary" = false
WHERE "isActive" = true AND (
  ("type" = 'EMAIL' AND "normalizedValue" !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') OR
  ("type" IN ('PHONE', 'WHATSAPP') AND ("normalizedValue" !~ '^[0-9]+$' OR length("normalizedValue") NOT BETWEEN 8 AND 15))
);

ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_active_normalized_format_check" CHECK (
  "isActive" = false OR
  ("type" = 'EMAIL' AND "normalizedValue" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') OR
  ("type" IN ('PHONE', 'WHATSAPP') AND "normalizedValue" ~ '^[0-9]+$' AND length("normalizedValue") BETWEEN 8 AND 15)
);

CREATE UNIQUE INDEX "CustomerConsent_companyId_customerId_operationKey_key" ON "CustomerConsent"("companyId", "customerId", "operationKey");
