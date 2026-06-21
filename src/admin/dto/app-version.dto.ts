import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export const APP_PLATFORMS = ['ios', 'android'] as const;

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const normalizePlatform = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateAppVersionDto {
  @Transform(normalizePlatform)
  @IsIn(APP_PLATFORMS)
  platform: (typeof APP_PLATFORMS)[number];

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  latest_version: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  min_supported_version: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  store_url?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateAppVersionDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  latest_version?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  min_supported_version?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  store_url?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
