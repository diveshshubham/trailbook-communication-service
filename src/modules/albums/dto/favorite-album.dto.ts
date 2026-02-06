import { IsMongoId } from 'class-validator';

export class FavoriteAlbumDto {
  @IsMongoId()
  albumId: string;
}
