ALTER TABLE "events"
ADD COLUMN "name_en" VARCHAR(255),
ADD COLUMN "name_vi" VARCHAR(255);

UPDATE "events"
SET
  "name_en" = COALESCE(NULLIF(TRIM("name_en"), ''), "name"),
  "name_vi" = COALESCE(NULLIF(TRIM("name_vi"), ''), "name");

ALTER TABLE "events"
ALTER COLUMN "name_en" SET NOT NULL,
ALTER COLUMN "name_vi" SET NOT NULL;
