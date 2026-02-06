import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Album, AlbumSchema } from '../../models/albums.schema';
import { AlbumInvitation, AlbumInvitationSchema } from '../../models/album-invitation.schema';
import { AlbumActivity, AlbumActivitySchema } from '../../models/album-activity.schema';
import { User, UserSchema } from '../../models/user.schema';
import { UserProfile, UserProfileSchema } from '../../models/user-profile.schema';
import { PublicAlbumService } from './public-album.service';
import { PublicAlbumController } from './public-album.controller';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Album.name, schema: AlbumSchema },
      { name: AlbumInvitation.name, schema: AlbumInvitationSchema },
      { name: AlbumActivity.name, schema: AlbumActivitySchema },
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    CommunicationModule, // For connection request service
  ],
  controllers: [PublicAlbumController],
  providers: [PublicAlbumService],
  exports: [PublicAlbumService],
})
export class PublicAlbumModule {}
