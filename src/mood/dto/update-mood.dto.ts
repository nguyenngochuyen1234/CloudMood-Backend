import { IsInt, Min, Max, IsOptional, IsString, IsArray, IsDateString } from 'class-validator';

export class UpdateMoodDto {
  @IsInt()
  @Min(1, { message: 'Mood score must be at least 1' })
  @Max(5, { message: 'Mood score cannot exceed 5' })
  @IsOptional()
  moodScore?: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsDateString()
  @IsOptional()
  entryDate?: string;
}
