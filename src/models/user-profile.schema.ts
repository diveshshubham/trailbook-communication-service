import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserProfileDocument = UserProfile & Document;

@Schema({ timestamps: true })
export class UserProfile {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    unique: true,
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop()
  fullName?: string;

  @Prop()
  bio?: string;

  @Prop()
  dob?: Date;

  @Prop()
  location?: string;

  @Prop()
  experience?: string; // trekking, cycling, etc (tags later)

  @Prop()
  website?: string;

  @Prop()
  profilePicture?: string; // S3 key

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [Types.ObjectId], ref: 'Album', default: [] })
  favoriteAlbumIds: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Media', default: [] })
  favoriteMediaIds: Types.ObjectId[];
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
