import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MediaDocument = Media & Document;

@Schema({ timestamps: true })
export class Media {
  @Prop({ type: Types.ObjectId, ref: 'Album', required: true })
  albumId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId; // uploader; only they can delete this media (optional for backward compatibility)

  @Prop({ required: true })
  key: string; // S3 object key

  @Prop({ required: true })
  contentType: string;

  @Prop()
  size?: number;

  // Optional per-photo details
  @Prop()
  title?: string;

  @Prop()
  description?: string;

  @Prop()
  location?: string;

  // Longer free-form story content about this photo
  @Prop()
  story?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  // Per-photo visibility (album visibility still applies)
  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const MediaSchema = SchemaFactory.createForClass(Media);
