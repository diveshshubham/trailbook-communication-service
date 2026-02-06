import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reflection, ReflectionSchema } from '../../models/reflection.schema';
import { Media, MediaSchema } from '../../models/media.schema';
import { Album, AlbumSchema } from '../../models/albums.schema';
import { UserProfile, UserProfileSchema } from '../../models/user-profile.schema';
import { ReflectionService } from './reflection.service';
import { ReflectionController } from './reflection.controller';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reflection.name, schema: ReflectionSchema },
      { name: Media.name, schema: MediaSchema },
      { name: Album.name, schema: AlbumSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    RedisModule,
  ],
  controllers: [ReflectionController],
  providers: [ReflectionService],
  exports: [ReflectionService],
})
export class ReflectionModule {}
