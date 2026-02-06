import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { Media, MediaSchema } from '../../models/media.schema';
import { Album, AlbumSchema } from '../../models/albums.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Media.name, schema: MediaSchema },
      { name: Album.name, schema: AlbumSchema },
    ]),
  ],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
