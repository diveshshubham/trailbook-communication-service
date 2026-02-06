import { ArrayUnique, IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMediaDetailsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  story?: string;

  // Optional: update tags here too (you also still have PATCH /media/:id/tags)
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  // Optional per-photo visibility
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

