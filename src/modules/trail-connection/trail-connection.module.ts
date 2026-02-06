import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TrailConnection,
  TrailConnectionSchema,
} from '../../models/trail-connection.schema';
import { AlbumFavorite, AlbumFavoriteSchema } from '../../models/album-favorite.schema';
import { Album, AlbumSchema } from '../../models/albums.schema';
import { UserProfile, UserProfileSchema } from '../../models/user-profile.schema';
import { MediaReflection, MediaReflectionSchema } from '../../models/media-reflection.schema';
import { Media, MediaSchema } from '../../models/media.schema';
import { TrailConnectionService } from './trail-connection.service';
import { TrailConnectionController } from './trail-connection.controller';
import { ReflectionModule } from '../reflection/reflection.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrailConnection.name, schema: TrailConnectionSchema },
      { name: AlbumFavorite.name, schema: AlbumFavoriteSchema },
      { name: Album.name, schema: AlbumSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: MediaReflection.name, schema: MediaReflectionSchema },
      { name: Media.name, schema: MediaSchema },
    ]),
    ReflectionModule,
  ],
  controllers: [TrailConnectionController],
  providers: [TrailConnectionService],
  exports: [TrailConnectionService],
})
export class TrailConnectionModule {}
