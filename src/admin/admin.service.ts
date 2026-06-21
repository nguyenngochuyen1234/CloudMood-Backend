import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../upload/r2.service';
import {
  ImageVariantName,
  ImageVariantUrls,
} from '../upload/image-asset.types';
import {
  APP_PLATFORMS,
  CreateAppVersionDto,
  UpdateAppVersionDto,
} from './dto/app-version.dto';

type ImageRecord = {
  imageUrl: string | null;
};

type ThemeWithImageRecords = {
  themeImages: ImageRecord[];
};

type AppVersionRecord = {
  platform: string;
  latestVersion: string;
  minSupportedVersion: string;
  storeUrl: string;
  isActive: boolean;
};

type EventNameInput = {
  name?: string;
  nameEn?: string;
  nameVi?: string;
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly appVersionPlatformOrder = [...APP_PLATFORMS];

  constructor(
    private prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  private mapEmojiPairConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Each emoji_type can only have one emoji for each emotion',
      );
    }

    throw error;
  }

  private async deleteConflictingEmojiByPair(
    tx: Prisma.TransactionClient,
    typeId: bigint,
    emotionId: bigint,
    excludeId?: bigint,
  ): Promise<string | null> {
    const conflictingEmoji = await tx.emoji.findFirst({
      where: {
        typeId,
        emotionId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });

    if (!conflictingEmoji) {
      return null;
    }

    await tx.emoji.delete({ where: { id: conflictingEmoji.id } });
    return conflictingEmoji.imageUrl;
  }

  private async deleteEmojiImageIfNeeded(
    imageUrl: string | null,
    preservedImageUrl?: string,
  ) {
    if (!imageUrl || imageUrl === preservedImageUrl) {
      return;
    }

    try {
      await this.r2.deleteByUrl(imageUrl);
    } catch (error) {
      this.logger.error(
        `Failed to delete replaced emoji image from R2: ${imageUrl}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private attachImageVariants<T extends ImageRecord>(
    item: T,
    preferredVariant?: ImageVariantName,
  ): T & { imageVariants: ImageVariantUrls | null } {
    const imageVariants = this.r2.resolveVariants(item.imageUrl);

    return {
      ...item,
      imageUrl:
        preferredVariant && imageVariants
          ? imageVariants[preferredVariant]
          : item.imageUrl,
      imageVariants,
    };
  }

  private attachImageVariantsToCollection<T extends ImageRecord>(items: T[]) {
    return items.map(item => this.attachImageVariants(item));
  }

  private attachOptimizedThemeImage<T extends ImageRecord>(item: T) {
    return this.attachImageVariants(item, 'medium');
  }

  private attachOptimizedThemeImages<T extends ImageRecord>(items: T[]) {
    return items.map(item => this.attachOptimizedThemeImage(item));
  }

  private attachThemeImageVariants<T extends ThemeWithImageRecords>(theme: T) {
    return {
      ...theme,
      themeImages: this.attachOptimizedThemeImages(theme.themeImages),
    };
  }

  private async deleteImageIfPresent(imageUrl: string | null | undefined) {
    if (!imageUrl) {
      return;
    }

    try {
      await this.r2.deleteByUrl(imageUrl);
    } catch (error) {
      this.logger.error(
        `Failed to delete image from R2: ${imageUrl}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private normalizeAppVersionPlatform(platform: string) {
    const normalizedPlatform = platform.trim().toLowerCase();

    if (!this.appVersionPlatformOrder.includes(normalizedPlatform as any)) {
      throw new BadRequestException(
        `platform must be one of: ${this.appVersionPlatformOrder.join(', ')}`,
      );
    }

    return normalizedPlatform;
  }

  private sortAppVersions<T extends { platform: string }>(items: T[]) {
    return [...items].sort((left, right) => {
      const leftIndex = this.appVersionPlatformOrder.indexOf(
        left.platform as (typeof APP_PLATFORMS)[number],
      );
      const rightIndex = this.appVersionPlatformOrder.indexOf(
        right.platform as (typeof APP_PLATFORMS)[number],
      );

      return leftIndex - rightIndex;
    });
  }

  private serializeAppVersion(item: AppVersionRecord) {
    return {
      platform: item.platform,
      latest_version: item.latestVersion,
      min_supported_version: item.minSupportedVersion,
      store_url: item.storeUrl,
      is_active: item.isActive,
    };
  }

  private normalizeOptionalString(value: string | null | undefined) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  private resolveEventNames(
    input: EventNameInput,
    existing?: { name: string; nameEn: string; nameVi: string },
  ) {
    const inputName = this.normalizeOptionalString(input.name);
    const inputNameEn = this.normalizeOptionalString(input.nameEn);
    const inputNameVi = this.normalizeOptionalString(input.nameVi);

    const name =
      inputName ??
      existing?.name ??
      inputNameEn ??
      inputNameVi;
    const nameEn =
      inputNameEn ??
      existing?.nameEn ??
      inputName ??
      inputNameVi ??
      existing?.name;
    const nameVi =
      inputNameVi ??
      existing?.nameVi ??
      inputName ??
      inputNameEn ??
      existing?.name;

    if (!name || !nameEn || !nameVi) {
      throw new BadRequestException(
        'Event name requires name, nameEn, or nameVi',
      );
    }

    return { name, nameEn, nameVi };
  }

  // ==================== USERS ====================
  async getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUserRole(id: string, role: string) {
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  // ==================== EMOTIONS ====================
  async getEmotions() {
    return this.prisma.emotion.findMany({ orderBy: { id: 'asc' } });
  }

  async createEmotion(data: {
    id: bigint;
    nameEn: string;
    nameVi: string;
    descriptionEn?: string;
    descriptionVi?: string;
    color?: string;
    score?: number;
    isPro?: boolean;
  }) {
    return this.prisma.emotion.create({ data });
  }

  async updateEmotion(
    id: bigint,
    data: {
      nameEn?: string;
      nameVi?: string;
      descriptionEn?: string;
      descriptionVi?: string;
      color?: string;
      score?: number;
      isPro?: boolean;
    },
  ) {
    const existing = await this.prisma.emotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Emotion not found');
    return this.prisma.emotion.update({ where: { id }, data });
  }

  async deleteEmotion(id: bigint) {
    const existing = await this.prisma.emotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Emotion not found');
    return this.prisma.emotion.delete({ where: { id } });
  }

  // ==================== EMOJI TYPES ====================
  async getEmojiTypes() {
    return this.prisma.emojiType.findMany({ orderBy: { id: 'asc' } });
  }

  async createEmojiType(data: {
    id: bigint;
    nameEn: string;
    nameVi: string;
    descriptionEn?: string;
    descriptionVi?: string;
    isActive?: boolean;
    isPro?: boolean;
  }) {
    return this.prisma.emojiType.create({ data });
  }

  async updateEmojiType(id: bigint, data: Partial<{ nameEn: string; nameVi: string; descriptionEn: string; descriptionVi: string; isActive: boolean; isPro: boolean }>) {
    const existing = await this.prisma.emojiType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('EmojiType not found');
    return this.prisma.emojiType.update({ where: { id }, data });
  }

  async deleteEmojiType(id: bigint) {
    const existing = await this.prisma.emojiType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('EmojiType not found');
    return this.prisma.emojiType.delete({ where: { id } });
  }

  // ==================== EMOJIS ====================
  async getEmojis(typeId?: bigint) {
    const emojis = await this.prisma.emoji.findMany({
      where: typeId ? { typeId } : undefined,
      include: { type: true, emotion: true },
      orderBy: { id: 'asc' },
    });
    return this.attachImageVariantsToCollection(emojis);
  }

  async createEmoji(data: { id: bigint; imageUrl: string; typeId: bigint; emotionId: bigint }) {
    try {
      let replacedEmojiImageUrl: string | null = null;

      const createdEmoji = await this.prisma.$transaction(async tx => {
        replacedEmojiImageUrl = await this.deleteConflictingEmojiByPair(
          tx,
          data.typeId,
          data.emotionId,
        );

        return tx.emoji.create({ data });
      });

      await this.deleteEmojiImageIfNeeded(
        replacedEmojiImageUrl,
        data.imageUrl,
      );

      return this.attachImageVariants(createdEmoji);
    } catch (error) {
      this.mapEmojiPairConflict(error);
    }
  }

  async updateEmoji(id: bigint, data: Partial<{ imageUrl: string; typeId: bigint; emotionId: bigint }>) {
    const existing = await this.prisma.emoji.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Emoji not found');

    const nextTypeId = data.typeId ?? existing.typeId;
    const nextEmotionId = data.emotionId ?? existing.emotionId;
    const finalImageUrl = data.imageUrl ?? existing.imageUrl;

    try {
      let replacedEmojiImageUrl: string | null = null;

      const updatedEmoji = await this.prisma.$transaction(async tx => {
        replacedEmojiImageUrl = await this.deleteConflictingEmojiByPair(
          tx,
          nextTypeId,
          nextEmotionId,
          id,
        );

        return tx.emoji.update({ where: { id }, data });
      });

      await this.deleteEmojiImageIfNeeded(replacedEmojiImageUrl, finalImageUrl);
      if (data.imageUrl && data.imageUrl !== existing.imageUrl) {
        await this.deleteImageIfPresent(existing.imageUrl);
      }

      return this.attachImageVariants(updatedEmoji);
    } catch (error) {
      this.mapEmojiPairConflict(error);
    }
  }

  async deleteEmoji(id: bigint) {
    const existing = await this.prisma.emoji.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Emoji not found');
    const deletedEmoji = await this.prisma.emoji.delete({ where: { id } });
    await this.deleteImageIfPresent(existing.imageUrl);
    return this.attachImageVariants(deletedEmoji);
  }

  async bulkCreateEmojis(emojis: Array<{ id: number; imageUrl: string; typeId: number; emotionId: number }>) {
    try {
      const createdEmojis = await this.prisma.$transaction(
        emojis.map(item =>
          this.prisma.emoji.create({
            data: {
              id: BigInt(item.id),
              imageUrl: item.imageUrl,
              typeId: BigInt(item.typeId),
              emotionId: BigInt(item.emotionId),
            },
          }),
        ),
      );
      return this.attachImageVariantsToCollection(createdEmojis);
    } catch (error) {
      this.mapEmojiPairConflict(error);
    }
  }

  // ==================== THEMES ====================
  async getThemes(params?: {
    page?: number;
    limit?: number;
    mode?: string;
  }) {
    const trimmedMode = params?.mode?.trim();
    const where = trimmedMode
      ? {
          mode: {
            equals: trimmedMode,
            mode: Prisma.QueryMode.insensitive,
          },
        }
      : undefined;

    const shouldPaginate =
      params?.page !== undefined || params?.limit !== undefined;

    if (!shouldPaginate) {
      const themes = await this.prisma.theme.findMany({
        where,
        include: { themeImages: true },
        orderBy: { createdAt: 'desc' },
      });
      return themes.map(theme => this.attachThemeImageVariants(theme));
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    const skip = (page - 1) * limit;

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.theme.findMany({
        where,
        include: { themeImages: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.theme.count({ where }),
    ]);

    return {
      items: items.map(item => this.attachThemeImageVariants(item)),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: skip + items.length < totalItems,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getThemesForHome() {
    const themes = await this.prisma.theme.findMany({
      select: {
        id: true,
        name: true,
        mode: true,
        isActive: true,
        isPro: true,
        colorsJson: true,
        createdAt: true,
        themeImages: {
          where: { type: 'home' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return themes.map(theme => this.attachThemeImageVariants(theme));
  }

  async getThemeById(id: string) {
    const theme = await this.prisma.theme.findUnique({
      where: { id },
      include: { themeImages: true },
    });

    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    return this.attachThemeImageVariants(theme);
  }

  async createTheme(data: {
    name: string;
    mode?: string;
    isActive?: boolean;
    isPro?: boolean;
    colorsJson: object;
  }) {
    return this.prisma.theme.create({ data: { ...data, colorsJson: data.colorsJson as any } });
  }

  async updateTheme(id: string, data: Partial<{ name: string; mode: string; isActive: boolean; isPro: boolean; colorsJson: object }>) {
    const existing = await this.prisma.theme.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Theme not found');
    return this.prisma.theme.update({ where: { id }, data: { ...data, colorsJson: data.colorsJson as any } });
  }

  async deleteTheme(id: string) {
    const existing = await this.prisma.theme.findUnique({
      where: { id },
      include: { themeImages: true },
    });
    if (!existing) throw new NotFoundException('Theme not found');
    const deletedTheme = await this.prisma.theme.delete({
      where: { id },
      include: { themeImages: true },
    });
    await Promise.all(
      existing.themeImages.map(image => this.deleteImageIfPresent(image.imageUrl)),
    );
    return this.attachThemeImageVariants(deletedTheme);
  }

  // ==================== EVENTS ====================
  async getEvents() {
    const events = await this.prisma.event.findMany({ orderBy: { createdAt: 'desc' } });
    return this.attachImageVariantsToCollection(events);
  }

  async createEvent(data: {
    name?: string;
    nameEn?: string;
    nameVi?: string;
    imageUrl?: string;
    color?: string;
    backgroundColor?: string;
    descriptionEn?: string;
    descriptionVi?: string;
  }) {
    const createdEvent = await this.prisma.event.create({
      data: {
        ...data,
        ...this.resolveEventNames(data),
      },
    });
    return this.attachImageVariants(createdEvent);
  }

  async updateEvent(id: string, data: Partial<{ name: string; nameEn: string; nameVi: string; imageUrl: string; color: string; backgroundColor: string; descriptionEn: string; descriptionVi: string }>) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Event not found');
    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: {
        ...data,
        ...this.resolveEventNames(data, {
          name: existing.name,
          nameEn: existing.nameEn,
          nameVi: existing.nameVi,
        }),
      },
    });
    if (data.imageUrl && data.imageUrl !== existing.imageUrl) {
      await this.deleteImageIfPresent(existing.imageUrl);
    }
    return this.attachImageVariants(updatedEvent);
  }

  async deleteEvent(id: string) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Event not found');
    const deletedEvent = await this.prisma.event.delete({ where: { id } });
    await this.deleteImageIfPresent(existing.imageUrl);
    return this.attachImageVariants(deletedEvent);
  }

  // ==================== THEME IMAGES ====================
  async createThemeImage(data: { themeId: string; type: string; imageUrl: string }) {
    const createdThemeImage = await this.prisma.themeImage.create({ data });
    return this.attachOptimizedThemeImage(createdThemeImage);
  }

  async deleteThemeImage(id: string) {
    const existing = await this.prisma.themeImage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('ThemeImage not found');
    const deletedThemeImage = await this.prisma.themeImage.delete({ where: { id } });
    await this.deleteImageIfPresent(existing.imageUrl);
    return this.attachOptimizedThemeImage(deletedThemeImage);
  }

  // ==================== APP VERSIONS ====================
  async getAppVersions(options?: { activeOnly?: boolean; platform?: string }) {
    const normalizedPlatform = options?.platform
      ? this.normalizeAppVersionPlatform(options.platform)
      : undefined;

    const appVersions = await this.prisma.appVersion.findMany({
      where: {
        ...(options?.activeOnly ? { isActive: true } : {}),
        ...(normalizedPlatform ? { platform: normalizedPlatform } : {}),
      },
      select: {
        platform: true,
        latestVersion: true,
        minSupportedVersion: true,
        storeUrl: true,
        isActive: true,
      },
    });

    return this.sortAppVersions(appVersions).map(item =>
      this.serializeAppVersion(item),
    );
  }

  async createAppVersion(data: CreateAppVersionDto) {
    try {
      const createdAppVersion = await this.prisma.appVersion.create({
        data: {
          platform: data.platform,
          latestVersion: data.latest_version,
          minSupportedVersion: data.min_supported_version,
          storeUrl: data.store_url ?? '',
          isActive: data.is_active ?? true,
        },
        select: {
          platform: true,
          latestVersion: true,
          minSupportedVersion: true,
          storeUrl: true,
          isActive: true,
        },
      });

      return this.serializeAppVersion(createdAppVersion);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('App version for this platform already exists');
      }

      throw error;
    }
  }

  async upsertAppVersions(items: CreateAppVersionDto[]) {
    const duplicatePlatforms = items.reduce<string[]>(
      (duplicates, item, index) => {
        const firstIndex = items.findIndex(
          candidate => candidate.platform === item.platform,
        );

        if (firstIndex !== index && !duplicates.includes(item.platform)) {
          duplicates.push(item.platform);
        }

        return duplicates;
      },
      [],
    );

    if (duplicatePlatforms.length > 0) {
      throw new BadRequestException(
        `Duplicate platform values are not allowed: ${duplicatePlatforms.join(', ')}`,
      );
    }

    const appVersions = await this.prisma.$transaction(
      items.map(item =>
        this.prisma.appVersion.upsert({
          where: { platform: item.platform },
          update: {
            latestVersion: item.latest_version,
            minSupportedVersion: item.min_supported_version,
            storeUrl: item.store_url ?? '',
            isActive: item.is_active ?? true,
          },
          create: {
            platform: item.platform,
            latestVersion: item.latest_version,
            minSupportedVersion: item.min_supported_version,
            storeUrl: item.store_url ?? '',
            isActive: item.is_active ?? true,
          },
          select: {
            platform: true,
            latestVersion: true,
            minSupportedVersion: true,
            storeUrl: true,
            isActive: true,
          },
        }),
      ),
    );

    return this.sortAppVersions(appVersions).map(item =>
      this.serializeAppVersion(item),
    );
  }

  async updateAppVersion(platform: string, data: UpdateAppVersionDto) {
    const normalizedPlatform = this.normalizeAppVersionPlatform(platform);
    const existing = await this.prisma.appVersion.findUnique({
      where: { platform: normalizedPlatform },
    });

    if (!existing) {
      throw new NotFoundException('App version not found');
    }

    return this.prisma.appVersion.update({
      select: {
        platform: true,
        latestVersion: true,
        minSupportedVersion: true,
        storeUrl: true,
        isActive: true,
      },
      where: { platform: normalizedPlatform },
      data: {
        latestVersion: data.latest_version,
        minSupportedVersion: data.min_supported_version,
        storeUrl: data.store_url,
        isActive: data.is_active,
      },
    }).then(item => this.serializeAppVersion(item));
  }

  // ==================== DASHBOARD ====================
  async getDashboardStats() {
    const [totalUsers, totalEmotions, totalThemes, totalEvents] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.emotion.count(),
        this.prisma.theme.count(),
        this.prisma.event.count(),
      ]);
    return { totalUsers, totalEmotions, totalThemes, totalEvents };
  }
}
