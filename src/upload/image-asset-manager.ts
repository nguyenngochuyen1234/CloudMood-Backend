import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash, randomBytes } from 'crypto';
import sharp from 'sharp';
import {
  IMAGE_VARIANT_NAMES,
  ImageVariantBytes,
  ImageVariantName,
  ImageVariantUrls,
  UploadedImageAsset,
} from './image-asset.types';

interface ImageStorageConfig {
  bucket: string;
  publicUrl: string;
  cacheControl?: string;
}

interface PreparedVariant {
  buffer: Buffer;
  bytes: number;
  contentType: string;
  key: string;
  name: ImageVariantName;
  url: string;
}

const IMAGE_VARIANT_WIDTHS: Record<ImageVariantName, number> = {
  original: 1600,
  medium: 768,
  thumb: 256,
};

const IMAGE_VARIANT_QUALITIES: Record<ImageVariantName, number> = {
  original: 82,
  medium: 76,
  thumb: 72,
};

const MANAGED_VARIANT_FILE_NAMES: Record<ImageVariantName, string> = {
  original: 'original.webp',
  medium: 'medium.webp',
  thumb: 'thumb.webp',
};

export const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export class ImageAssetManager {
  private readonly bucket: string;
  private readonly cacheControl: string;
  private readonly publicUrl: string;

  constructor(
    private readonly client: S3Client,
    config: ImageStorageConfig,
  ) {
    this.bucket = config.bucket;
    this.cacheControl = config.cacheControl ?? IMAGE_CACHE_CONTROL;
    this.publicUrl = config.publicUrl.replace(/\/$/, '');
  }

  async uploadImage(
    buffer: Buffer,
    originalName: string,
    folder = 'emojis',
  ): Promise<UploadedImageAsset> {
    const assetPrefix = this.createAssetPrefix(buffer, originalName, folder);
    const variants = await this.prepareVariants(buffer, assetPrefix);

    await Promise.all(
      variants.map(variant =>
        this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: variant.key,
            Body: variant.buffer,
            CacheControl: this.cacheControl,
            ContentDisposition: 'inline',
            ContentType: variant.contentType,
          }),
        ),
      ),
    );

    const metadata = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .metadata();

    const variantUrls = variants.reduce<ImageVariantUrls>((result, variant) => {
      result[variant.name] = variant.url;
      return result;
    }, {} as ImageVariantUrls);

    const variantBytes = variants.reduce<ImageVariantBytes>((result, variant) => {
      result[variant.name] = variant.bytes;
      return result;
    }, {} as ImageVariantBytes);

    return {
      url: variantUrls.original,
      imageUrl: variantUrls.original,
      variants: variantUrls,
      bytes: variantBytes,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      contentType: 'image/webp',
      assetPrefix,
    };
  }

  resolveVariants(imageUrl: string | null | undefined): ImageVariantUrls | null {
    if (!imageUrl) {
      return null;
    }

    const key = this.extractKeyFromSameHostUrl(imageUrl);
    if (!key) {
      return null;
    }

    const managedPrefix = this.extractManagedAssetPrefixFromPath(key);
    if (!managedPrefix) {
      return null;
    }

    return this.buildVariantUrls(managedPrefix);
  }

  shouldMigrateUrl(url: string | null | undefined): boolean {
    if (!url) {
      return false;
    }

    return this.resolveVariants(url) === null;
  }

  rewriteManagedUrlToPublicHost(url: string): string | null {
    try {
      const targetUrl = new URL(url);
      const managedPrefix = this.extractManagedAssetPrefixFromPath(
        targetUrl.pathname.replace(/^\/+/, ''),
      );

      if (!managedPrefix) {
        return null;
      }

      return this.buildVariantUrls(managedPrefix).original;
    } catch {
      return null;
    }
  }

  async migrateRemoteImage(
    remoteUrl: string,
    folder: string,
  ): Promise<UploadedImageAsset> {
    const rewrittenManagedUrl = this.rewriteManagedUrlToPublicHost(remoteUrl);
    if (rewrittenManagedUrl) {
      return {
        url: rewrittenManagedUrl,
        imageUrl: rewrittenManagedUrl,
        variants: this.resolveVariants(rewrittenManagedUrl) ?? {
          original: rewrittenManagedUrl,
          medium: rewrittenManagedUrl,
          thumb: rewrittenManagedUrl,
        },
        bytes: { original: 0, medium: 0, thumb: 0 },
        width: null,
        height: null,
        contentType: 'image/webp',
        assetPrefix: '',
      };
    }

    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Remote URL is not an image: ${remoteUrl}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileName = this.getRemoteFileName(remoteUrl);

    return this.uploadImage(Buffer.from(arrayBuffer), fileName, folder);
  }

  async deleteManagedAssetByUrl(url: string): Promise<boolean> {
    const key = this.extractKeyFromSameHostUrl(url);
    if (!key) {
      return false;
    }

    const managedPrefix = this.extractManagedAssetPrefixFromPath(key);
    if (!managedPrefix) {
      await this.deleteObject(key);
      return true;
    }

    await Promise.all(
      IMAGE_VARIANT_NAMES.map(name =>
        this.deleteObject(this.buildVariantKey(managedPrefix, name)),
      ),
    );

    return true;
  }

  private async prepareVariants(
    buffer: Buffer,
    assetPrefix: string,
  ): Promise<PreparedVariant[]> {
    return Promise.all(
      IMAGE_VARIANT_NAMES.map(async name => {
        const transformed = await sharp(buffer, { failOn: 'none' })
          .rotate()
          .resize({
            width: IMAGE_VARIANT_WIDTHS[name],
            withoutEnlargement: true,
          })
          .webp({
            quality: IMAGE_VARIANT_QUALITIES[name],
            effort: 4,
          })
          .toBuffer();

        const key = this.buildVariantKey(assetPrefix, name);
        return {
          buffer: transformed,
          bytes: transformed.byteLength,
          contentType: 'image/webp',
          key,
          name,
          url: `${this.publicUrl}/${key}`,
        };
      }),
    );
  }

  private createAssetPrefix(
    buffer: Buffer,
    originalName: string,
    folder: string,
  ) {
    const sanitizedFolder = this.sanitizePathSegment(folder, 'emojis');
    const baseName = this
      .sanitizePathSegment(originalName.replace(/\.[^.]+$/, ''), 'image')
      .slice(0, 40);
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
    const token = randomBytes(4).toString('hex');
    return `${sanitizedFolder}/${Date.now()}-${hash}-${token}-${baseName}`;
  }

  private buildVariantKey(assetPrefix: string, variantName: ImageVariantName) {
    return `${assetPrefix}/${MANAGED_VARIANT_FILE_NAMES[variantName]}`;
  }

  private buildVariantUrls(assetPrefix: string): ImageVariantUrls {
    return {
      original: `${this.publicUrl}/${this.buildVariantKey(assetPrefix, 'original')}`,
      medium: `${this.publicUrl}/${this.buildVariantKey(assetPrefix, 'medium')}`,
      thumb: `${this.publicUrl}/${this.buildVariantKey(assetPrefix, 'thumb')}`,
    };
  }

  private extractManagedAssetPrefixFromPath(path: string) {
    const normalizedPath = path.replace(/^\/+/, '');
    for (const variantFileName of Object.values(MANAGED_VARIANT_FILE_NAMES)) {
      if (normalizedPath.endsWith(`/${variantFileName}`)) {
        return normalizedPath.slice(0, normalizedPath.length - variantFileName.length - 1);
      }
    }

    return null;
  }

  private extractKeyFromSameHostUrl(url: string): string | null {
    try {
      const publicUrl = new URL(this.publicUrl);
      const targetUrl = new URL(url);

      if (publicUrl.origin !== targetUrl.origin) {
        return null;
      }

      const basePath = publicUrl.pathname.replace(/\/$/, '');
      if (basePath && !targetUrl.pathname.startsWith(`${basePath}/`)) {
        return null;
      }

      return targetUrl.pathname
        .slice(basePath.length)
        .replace(/^\/+/, '') || null;
    } catch {
      return null;
    }
  }

  private getRemoteFileName(remoteUrl: string) {
    try {
      const parsedUrl = new URL(remoteUrl);
      const fileName = parsedUrl.pathname.split('/').filter(Boolean).pop();
      return fileName && fileName.length > 0 ? fileName : 'remote-image';
    } catch {
      return 'remote-image';
    }
  }

  private sanitizePathSegment(value: string, fallback: string) {
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return sanitized || fallback;
  }

  private async deleteObject(key: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
