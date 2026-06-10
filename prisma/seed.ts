import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function readJson<T>(filename: string): T {
  const filePath = path.join(__dirname, 'data', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

async function seedEmojiTypes() {
  const data = readJson<any[]>('data_typeEmoji.json');
  for (const item of data) {
    await prisma.emojiType.upsert({
      where: { id: BigInt(item.id) },
      create: {
        id: BigInt(item.id),
        nameEn: item.name.en,
        nameVi: item.name.vi,
        descriptionEn: item.description?.en ?? null,
        descriptionVi: item.description?.vi ?? null,
        isActive: item.isActive,
        isPro: item.isPro,
      },
      update: {
        nameEn: item.name.en,
        nameVi: item.name.vi,
        descriptionEn: item.description?.en ?? null,
        descriptionVi: item.description?.vi ?? null,
        isActive: item.isActive,
        isPro: item.isPro,
      },
    });
  }
  console.log(`✓ Seeded ${data.length} emoji types`);
}

async function seedEmotions() {
  const data = readJson<any[]>('data_emotions.json');
  for (const item of data) {
    await prisma.emotion.upsert({
      where: { id: BigInt(item.id) },
      create: {
        id: BigInt(item.id),
        nameEn: item.name.en,
        nameVi: item.name.vi,
        descriptionEn: item.description?.en ?? null,
        descriptionVi: item.description?.vi ?? null,
        color: item.color ?? null,
        score: item.score,
        isPro: item.isPro,
      },
      update: {
        nameEn: item.name.en,
        nameVi: item.name.vi,
        descriptionEn: item.description?.en ?? null,
        descriptionVi: item.description?.vi ?? null,
        color: item.color ?? null,
        score: item.score,
        isPro: item.isPro,
      },
    });
  }
  console.log(`✓ Seeded ${data.length} emotions`);
}

async function seedEmojis() {
  const data = readJson<any[]>('data_emojis.json');
  for (const item of data) {
    await prisma.emoji.upsert({
      where: { id: BigInt(item.id) },
      create: {
        id: BigInt(item.id),
        imageUrl: item.image,
        typeId: BigInt(item.type_id),
        emotionId: BigInt(item.emotion_id),
      },
      update: {
        imageUrl: item.image,
        typeId: BigInt(item.type_id),
        emotionId: BigInt(item.emotion_id),
      },
    });
  }
  console.log(`✓ Seeded ${data.length} emojis`);
}

async function seedThemes() {
  const data = readJson<any[]>('data_themes.json');
  for (const item of data) {
    const colorsJson =
      typeof item.colors_json === 'string'
        ? JSON.parse(item.colors_json)
        : item.colors_json;
    await prisma.theme.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        name: item.name,
        colorsJson,
        mode: item.mode ?? null,
        isActive: item.isActive,
        isPro: item.isPro,
      },
      update: {
        name: item.name,
        colorsJson,
        mode: item.mode ?? null,
        isActive: item.isActive,
        isPro: item.isPro,
      },
    });
  }
  console.log(`✓ Seeded ${data.length} themes`);
}

async function seedThemeImages() {
  const data = readJson<any[]>('data_theme_images.json');
  for (const item of data) {
    await prisma.themeImage.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        themeId: item.theme_id,
        type: item.type,
        imageUrl: item.image_url,
      },
      update: {
        themeId: item.theme_id,
        type: item.type,
        imageUrl: item.image_url,
      },
    });
  }
  console.log(`✓ Seeded ${data.length} theme images`);
}

async function seedEvents() {
  const data = readJson<any[]>('data_events.json');
  for (const item of data) {
    await prisma.event.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        name: item.name,
        imageUrl: item.image ?? null,
        color: item.color ?? null,
        backgroundColor: item.backgroundColor ?? null,
        descriptionEn: item.descriptionEn ?? null,
        descriptionVi: item.descriptionVi ?? null,
      },
      update: {
        name: item.name,
        imageUrl: item.image ?? null,
        color: item.color ?? null,
        backgroundColor: item.backgroundColor ?? null,
        descriptionEn: item.descriptionEn ?? null,
        descriptionVi: item.descriptionVi ?? null,
      },
    });
  }
  console.log(`✓ Seeded ${data.length} events`);
}

async function main() {
  console.log('Starting seed...\n');

  await seedEmojiTypes();
  await seedEmotions();
  await seedEmojis();
  await seedThemes();
  await seedThemeImages();
  await seedEvents();

  console.log('\nSeed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
