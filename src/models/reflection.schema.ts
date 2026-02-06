import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReflectionDocument = Reflection & Document;

export enum ReflectionReason {
  COMPOSITION = 'composition',
  MOMENT = 'moment',
  EMOTION = 'emotion',
  STORY = 'story',
}

@Schema({ timestamps: true })
export class Reflection {
  @Prop({ type: Types.ObjectId, ref: 'Media', required: true, index: true })
  mediaId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ReflectionReason),
    required: true,
  })
  reason: ReflectionReason;

  @Prop({ maxlength: 50 })
  note?: string;

  @Prop({ default: false })
  isAnonymous: boolean;

  // Timestamps are automatically added by Mongoose
  createdAt?: Date;
  updatedAt?: Date;
}

export const ReflectionSchema = SchemaFactory.createForClass(Reflection);

// Compound unique index: one user can reflect on a media only once
ReflectionSchema.index({ userId: 1, mediaId: 1 }, { unique: true });

// Index for fast "get all reflections for a media" queries
ReflectionSchema.index({ mediaId: 1, createdAt: -1 });

// Index for fast "get all reflections by a user" queries
ReflectionSchema.index({ userId: 1, createdAt: -1 });

// Index for connection eligibility checks (non-anonymous reflections)
ReflectionSchema.index({ userId: 1, isAnonymous: 1, createdAt: -1 });
