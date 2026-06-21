CREATE TABLE "app_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" VARCHAR(20) NOT NULL,
    "latest_version" VARCHAR(50) NOT NULL,
    "min_supported_version" VARCHAR(50) NOT NULL,
    "store_url" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_versions_platform_key" ON "app_versions"("platform");
