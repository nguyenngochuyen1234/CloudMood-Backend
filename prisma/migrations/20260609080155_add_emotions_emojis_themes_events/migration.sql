-- CreateTable
CREATE TABLE "emotions" (
    "id" BIGINT NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "name_vi" VARCHAR(100) NOT NULL,
    "description_en" TEXT,
    "description_vi" TEXT,
    "color" VARCHAR(20),
    "score" INTEGER NOT NULL DEFAULT 0,
    "is_pro" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emoji_types" (
    "id" BIGINT NOT NULL,
    "name_en" VARCHAR(255) NOT NULL,
    "name_vi" VARCHAR(255) NOT NULL,
    "description_en" TEXT,
    "description_vi" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_pro" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emoji_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emojis" (
    "id" BIGINT NOT NULL,
    "image_url" TEXT NOT NULL,
    "type_id" BIGINT NOT NULL,
    "emotion_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emojis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "mode" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_pro" BOOLEAN NOT NULL DEFAULT false,
    "colors_json" JSONB NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "theme_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "theme_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "image_url" TEXT,
    "color" VARCHAR(20),
    "background_color" VARCHAR(20),
    "description_en" TEXT,
    "description_vi" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "emojis" ADD CONSTRAINT "emojis_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "emoji_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emojis" ADD CONSTRAINT "emojis_emotion_id_fkey" FOREIGN KEY ("emotion_id") REFERENCES "emotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_images" ADD CONSTRAINT "theme_images_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
