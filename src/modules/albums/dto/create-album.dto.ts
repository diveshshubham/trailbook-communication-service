import { IsBoolean, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class CreateAlbumDto {
  @ValidateIf((o) => !o.name)
  @IsString()
  @MinLength(1)
  title?: string;

  // Preferred field name for clients
  @ValidateIf((o) => !o.title)
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  location?: string;

  // Longer free-form story content about the album/journey
  @IsOptional()
  @IsString()
  @MinLength(1)
  story?: string;

  // Optional S3 key / URL for a custom cover image
  @IsOptional()
  @IsString()
  @MinLength(1)
  coverImage?: string;

  // User's requested visibility; albums still start private until they have media.
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

