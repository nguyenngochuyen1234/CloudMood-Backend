import 'dotenv/config';
import { S3Client } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { ImageAssetManager } from '../src/upload/image-asset-manager';

type TargetEntity = 'emojis' | 'theme-images' | 'events';

type Summary = {
  checked: number;
  migrated: number;
  skipped: number;
  failed: number;
};

interface ScriptOptions {
  dryRun: boolean;
  entity?: TargetEntity;
  limit?: number;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!databaseUrl || !accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    throw new Error('Missing DATABASE_URL or R2_* environment configuration.');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const manager = new ImageAssetManager(client, {
    bucket,
    publicUrl,
  });

  const options = parseOptions(process.argv.slice(2));
  const summary: Summary = {
    checked: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    await prisma.$connect();

    if (!options.entity || options.entity === 'emojis') {
      await migrateEmojis(prisma, manager, options, summary);
    }

    if (!options.entity || options.entity === 'theme-images') {
      await migrateThemeImages(prisma, manager, options, summary);
    }

    if (!options.entity || options.entity === 'events') {
      await migrateEvents(prisma, manager, options, summary);
    }

    console.log('Image migration summary:', summary);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function migrateEmojis(
  prisma: PrismaClient,
  manager: ImageAssetManager,
  options: ScriptOptions,
  summary: Summary,
) {
  const emojis = await prisma.emoji.findMany({
    orderBy: { id: 'asc' },
    take: options.limit,
  });

  for (const emoji of emojis) {
    await migrateSingleRecord({
      currentUrl: emoji.imageUrl,
      folder: 'emojis',
      label: `emoji:${emoji.id.toString()}`,
      manager,
      onUpdate: nextUrl =>
        prisma.emoji.update({
          where: { id: emoji.id },
          data: { imageUrl: nextUrl },
        }),
      options,
      summary,
    });
  }
}

async function migrateThemeImages(
  prisma: PrismaClient,
  manager: ImageAssetManager,
  options: ScriptOptions,
  summary: Summary,
) {
  const themeImages = await prisma.themeImage.findMany({
    orderBy: { createdAt: 'asc' },
    take: options.limit,
  });

  for (const themeImage of themeImages) {
    await migrateSingleRecord({
      currentUrl: themeImage.imageUrl,
      folder: 'theme-images',
      label: `theme-image:${themeImage.id}`,
      manager,
      onUpdate: nextUrl =>
        prisma.themeImage.update({
          where: { id: themeImage.id },
          data: { imageUrl: nextUrl },
        }),
      options,
      summary,
    });
  }
}

async function migrateEvents(
  prisma: PrismaClient,
  manager: ImageAssetManager,
  options: ScriptOptions,
  summary: Summary,
) {
  const events = await prisma.event.findMany({
    where: {
      imageUrl: {
        not: null,
      },
    },
    orderBy: { createdAt: 'asc' },
    take: options.limit,
  });

  for (const event of events) {
    await migrateSingleRecord({
      currentUrl: event.imageUrl,
      folder: 'events',
      label: `event:${event.id}`,
      manager,
      onUpdate: nextUrl =>
        prisma.event.update({
          where: { id: event.id },
          data: { imageUrl: nextUrl },
        }),
      options,
      summary,
    });
  }
}

async function migrateSingleRecord(params: {
  currentUrl: string | null;
  folder: string;
  label: string;
  manager: ImageAssetManager;
  onUpdate: (nextUrl: string) => Promise<unknown>;
  options: ScriptOptions;
  summary: Summary;
}) {
  const { currentUrl, folder, label, manager, onUpdate, options, summary } = params;

  summary.checked += 1;

  if (!currentUrl || !manager.shouldMigrateUrl(currentUrl)) {
    summary.skipped += 1;
    console.log(`[skip] ${label} -> ${currentUrl ?? 'null'}`);
    return;
  }

  try {
    const migrated = await manager.migrateRemoteImage(currentUrl, folder);
    console.log(`[migrate] ${label} -> ${migrated.imageUrl}`);

    if (!options.dryRun) {
      await onUpdate(migrated.imageUrl);
    }

    summary.migrated += 1;
  } catch (error) {
    summary.failed += 1;
    console.error(
      `[fail] ${label} -> ${currentUrl}`,
      error instanceof Error ? error.message : error,
    );
  }
}

function parseOptions(args: string[]): ScriptOptions {
  const options: ScriptOptions = {
    dryRun: args.includes('--dry-run'),
  };

  for (const arg of args) {
    if (arg.startsWith('--entity=')) {
      const entity = arg.slice('--entity='.length) as TargetEntity;
      if (entity === 'emojis' || entity === 'theme-images' || entity === 'events') {
        options.entity = entity;
      }
    }

    if (arg.startsWith('--limit=')) {
      const parsedLimit = Number(arg.slice('--limit='.length));
      if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
        options.limit = parsedLimit;
      }
    }
  }

  return options;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
