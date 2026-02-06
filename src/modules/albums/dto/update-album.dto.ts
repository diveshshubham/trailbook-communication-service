import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateAlbumDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  location?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  story?: string;

  // Convenience: allow clients to toggle visibility on the same endpoint.
  // Business rules still apply (empty albums stay private).
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

