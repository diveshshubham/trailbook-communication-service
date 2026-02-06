import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlbumInvitationDocument = AlbumInvitation & Document;

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export enum InvitationPermission {
  CONTRIBUTOR = 'contributor', // Can add media
  VIEWER = 'viewer', // Can only view
  ADMIN = 'admin', // Can manage album and invite others
}

@Schema({ timestamps: true })
export class AlbumInvitation {
  @Prop({ type: Types.ObjectId, ref: 'Album', required: true, index: true })
  albumId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  inviterId: Types.ObjectId; // User who sent the invitation

  // Invitee can be identified by userId, email, or phone
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  inviteeUserId?: Types.ObjectId; // If user exists on platform

  @Prop({ index: true })
  inviteeEmail?: string; // If user doesn't exist yet

  @Prop({ index: true })
  inviteePhone?: string; // If user doesn't exist yet

  @Prop({
    type: String,
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
    index: true,
  })
  status: InvitationStatus;

  @Prop({
    type: String,
    enum: InvitationPermission,
    default: InvitationPermission.CONTRIBUTOR,
  })
  permission: InvitationPermission; // Permission level for the album

  @Prop({ default: true })
  autoConnect: boolean; // Auto-connect inviter and invitee when accepted

  @Prop({ type: Date })
  acceptedAt?: Date;

  @Prop({ type: Date })
  rejectedAt?: Date;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export const AlbumInvitationSchema =
  SchemaFactory.createForClass(AlbumInvitation);

// Compound indexes for efficient queries
AlbumInvitationSchema.index({ albumId: 1, status: 1 });
AlbumInvitationSchema.index({ inviterId: 1, status: 1 });
AlbumInvitationSchema.index({ inviteeUserId: 1, status: 1 });
AlbumInvitationSchema.index({ inviteeEmail: 1, status: 1 });
AlbumInvitationSchema.index({ inviteePhone: 1, status: 1 });

// Unique constraint: one pending invitation per album + invitee identifier
AlbumInvitationSchema.index(
  { albumId: 1, inviteeUserId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      inviteeUserId: { $exists: true },
      status: InvitationStatus.PENDING,
    },
  },
);

AlbumInvitationSchema.index(
  { albumId: 1, inviteeEmail: 1 },
  {
    unique: true,
    partialFilterExpression: {
      inviteeEmail: { $exists: true },
      status: InvitationStatus.PENDING,
    },
  },
);

AlbumInvitationSchema.index(
  { albumId: 1, inviteePhone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      inviteePhone: { $exists: true },
      status: InvitationStatus.PENDING,
    },
  },
);
