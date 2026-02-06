import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlbumFavoriteDocument = AlbumFavorite & Document;

@Schema({ timestamps: true })
export class AlbumFavorite {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Album', required: true, index: true })
  albumId: Types.ObjectId;

  // Timestamps are automatically added by Mongoose, but we declare them for TypeScript
  createdAt?: Date;
  updatedAt?: Date;
}

export const AlbumFavoriteSchema = SchemaFactory.createForClass(AlbumFavorite);

// Compound unique index: one user can favorite an album only once
// This also speeds up queries for "is this album favorited by this user?"
AlbumFavoriteSchema.index({ userId: 1, albumId: 1 }, { unique: true });

// Index for fast "get all favorites for a user" queries
AlbumFavoriteSchema.index({ userId: 1, createdAt: -1 });
