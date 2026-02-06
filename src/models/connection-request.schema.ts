import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConnectionRequestDocument = ConnectionRequest & Document;

export enum ConnectionRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class ConnectionRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  requesterId: Types.ObjectId; // User who sent the request

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recipientId: Types.ObjectId; // User who receives the request

  @Prop({
    type: String,
    enum: ConnectionRequestStatus,
    default: ConnectionRequestStatus.PENDING,
    index: true,
  })
  status: ConnectionRequestStatus;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export const ConnectionRequestSchema =
  SchemaFactory.createForClass(ConnectionRequest);

// Compound unique index to ensure one pending request per user pair
// This allows multiple requests (e.g., rejected ones) but only one pending
ConnectionRequestSchema.index(
  { requesterId: 1, recipientId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: ConnectionRequestStatus.PENDING },
  },
);

// Index for fast queries
ConnectionRequestSchema.index({ requesterId: 1, status: 1 });
ConnectionRequestSchema.index({ recipientId: 1, status: 1 });
