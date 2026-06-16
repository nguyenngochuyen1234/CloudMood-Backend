export const IMAGE_VARIANT_NAMES = ['original', 'medium', 'thumb'] as const;

export type ImageVariantName = (typeof IMAGE_VARIANT_NAMES)[number];

export type ImageVariantUrls = Record<ImageVariantName, string>;

export type ImageVariantBytes = Record<ImageVariantName, number>;

export interface UploadedImageAsset {
  url: string;
  imageUrl: string;
  variants: ImageVariantUrls;
  bytes: ImageVariantBytes;
  width: number | null;
  height: number | null;
  contentType: string;
  assetPrefix: string;
}
