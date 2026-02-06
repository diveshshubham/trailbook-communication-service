import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Album, AlbumSchema } from '../../models/albums.schema';
import { AlbumFavorite, AlbumFavoriteSchema } from '../../models/album-favorite.schema';
import { UserProfile, UserProfileSchema } from '../../models/user-profile.schema';
import { AlbumsService } from './albums.service';
import { AlbumsController } from './albums.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Album.name, schema: AlbumSchema },
      { name: AlbumFavorite.name, schema: AlbumFavoriteSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
  ],
  controllers: [AlbumsController],
  providers: [AlbumsService],
})
export class AlbumsModule {}
