import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlbumActivityDocument = AlbumActivity & Document;

export enum ActivityType {
  MEDIA_ADDED = 'media_added',
  CONTRIBUTOR_ADDED = 'contributor_added',
  CONTRIBUTOR_REMOVED = 'contributor_removed',
  ALBUM_UPDATED = 'album_updated',
  INVITATION_SENT = 'invitation_sent',
  INVITATION_ACCEPTED = 'invitation_accepted',
}

@Schema({ timestamps: true })
export class AlbumActivity {
  @Prop({ type: Types.ObjectId, ref: 'Album', required: true, index: true })
  albumId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId; // User who performed the action

  @Prop({
    type: String,
    enum: ActivityType,
    required: true,
    index: true,
  })
  activityType: ActivityType;

  @Prop({ type: Types.ObjectId, ref: 'Media' })
  mediaId?: Types.ObjectId; // If activity is related to media

  @Prop({ type: Types.ObjectId, ref: 'User' })
  targetUserId?: Types.ObjectId; // If activity involves another user

  @Prop()
  description?: string; // Human-readable description

  // Metadata for different activity types
  @Prop({ type: Object })
  metadata?: Record<string, any>;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export const AlbumActivitySchema = SchemaFactory.createForClass(AlbumActivity);

// Indexes for efficient queries
AlbumActivitySchema.index({ albumId: 1, createdAt: -1 });
AlbumActivitySchema.index({ userId: 1, createdAt: -1 });
AlbumActivitySchema.index({ activityType: 1, createdAt: -1 });
