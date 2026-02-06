import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MediaReflectionDocument = MediaReflection & Document;

@Schema({ timestamps: true })
export class MediaReflection {
  @Prop({ type: Types.ObjectId, ref: 'Media', required: true, index: true })
  mediaId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ReflectionType', required: true })
  reflectionTypeId: Types.ObjectId;

  // Denormalized display fields for fast reads (avoid lookup)
  @Prop({ required: true })
  reflectionLabel: string;

  @Prop()
  reflectionEmoji?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MediaReflectionSchema = SchemaFactory.createForClass(MediaReflection);

// One reflection per user per media (enables upsert + update)
MediaReflectionSchema.index({ mediaId: 1, userId: 1 }, { unique: true });

// Fast listing by media
MediaReflectionSchema.index({ mediaId: 1, createdAt: -1, _id: -1 });
