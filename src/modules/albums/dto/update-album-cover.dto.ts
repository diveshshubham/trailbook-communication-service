import { IsString, MinLength } from 'class-validator';

export class UpdateAlbumCoverDto {
  @IsString()
  @MinLength(1)
  coverImage: string; // S3 key or URL
}

