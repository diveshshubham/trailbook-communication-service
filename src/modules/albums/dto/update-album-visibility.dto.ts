import { IsBoolean } from 'class-validator';

export class UpdateAlbumVisibilityDto {
  @IsBoolean()
  isPublic: boolean;
}

