import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  senderId: Types.ObjectId; // User who sent the message

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  receiverId: Types.ObjectId; // User who receives the message

  @Prop({ required: true })
  content: string; // Message content

  // File attachment fields
  @Prop({ default: false })
  hasFile: boolean; // Whether message has a file attachment

  @Prop()
  fileKey?: string; // S3 object key (temporary, before upload completes)

  @Prop()
  fileUrl?: string; // S3 URL (after upload completes)

  @Prop()
  fileName?: string; // Original file name

  @Prop()
  fileType?: string; // MIME type (e.g., image/jpeg, application/pdf, text/plain)

  @Prop()
  fileSize?: number; // File size in bytes

  @Prop({ default: false })
  isFileUploaded: boolean; // Whether file upload to S3 is complete

  @Prop({ default: false })
  isRead: boolean; // Whether the message has been read

  @Prop({ type: Date })
  readAt?: Date; // When the message was read

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Compound index for efficient chat queries
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, isRead: 1 }); // For unread count queries
