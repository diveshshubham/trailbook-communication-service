import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlbumDocument = Album & Document;

@Schema({ timestamps: true })
export class Album {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop()
  coverImage?: string; // S3 key

  @Prop({ default: 0 })
  photoCount: number;

  @Prop()
  location?: string;

  @Prop()
  story?: string;

  @Prop()
  eventDate?: Date;

  // Actual visibility. Enforced to stay private while photoCount === 0.
  @Prop({ default: false })
  isPublic: boolean;

  // User's intent/request to make the album public once it has media.
  @Prop({ default: false })
  isPublicRequested: boolean;

  // Archive: hidden from user's album list but still public
  @Prop({ default: false })
  isArchived: boolean;

  // Hard delete: permanently removed
  @Prop({ default: false })
  isDeleted: boolean;

  // Public album features
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  contributorIds: Types.ObjectId[]; // Users who can add media to this album

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId; // Original creator (for public albums)

  @Prop({ default: false })
  allowContributors: boolean; // Whether album accepts contributors

  @Prop({ default: 0 })
  contributorCount: number; // Number of active contributors
}


export const AlbumSchema = SchemaFactory.createForClass(Album);

// Enforce: empty album cannot be public
AlbumSchema.pre('save', async function () {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = this;
  if (typeof doc.photoCount === 'number' && doc.photoCount <= 0) {
    doc.isPublic = false;
  }
});
