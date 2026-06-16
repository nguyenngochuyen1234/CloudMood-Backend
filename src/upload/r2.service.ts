import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { ImageAssetManager } from './image-asset-manager';
import { ImageVariantUrls, UploadedImageAsset } from './image-asset.types';

@Injectable()
export class R2Service {
  private readonly manager: ImageAssetManager;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME ?? '';
    const publicUrl = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
      throw new InternalServerErrorException(
        'R2 is not fully configured. Please verify R2_* environment variables.',
      );
    }

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    this.manager = new ImageAssetManager(client, {
      bucket,
      publicUrl,
    });
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    folder = 'emojis',
  ): Promise<UploadedImageAsset> {
    return this.manager.uploadImage(buffer, originalName, folder);
  }

  async deleteByUrl(url: string): Promise<boolean> {
    return this.manager.deleteManagedAssetByUrl(url);
  }

  resolveVariants(imageUrl: string | null | undefined): ImageVariantUrls | null {
    return this.manager.resolveVariants(imageUrl);
  }

  shouldMigrateUrl(url: string | null | undefined) {
    return this.manager.shouldMigrateUrl(url);
  }

  async migrateRemoteImage(remoteUrl: string, folder: string) {
    return this.manager.migrateRemoteImage(remoteUrl, folder);
  }
}
