import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TrailConnectionDocument = TrailConnection & Document;

@Schema({ timestamps: true })
export class TrailConnection {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userA: Types.ObjectId; // The user who initiated the connection

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userB: Types.ObjectId; // The other user

  @Prop({ type: [Types.ObjectId], ref: 'Album', default: [] })
  mutualAlbumIds: Types.ObjectId[]; // Albums both users have favorited

  @Prop({ default: 0 })
  reflectionCount: number; // Number of reflections between them

  @Prop({ default: false })
  isActive: boolean; // Connection is active (both users are connected)

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export const TrailConnectionSchema = SchemaFactory.createForClass(TrailConnection);

// Compound unique index: ensure one connection record per user pair
// Store users in sorted order to avoid duplicates (A-B and B-A are the same)
TrailConnectionSchema.index({ userA: 1, userB: 1 }, { unique: true });

// Index for fast "get all connections for a user" queries
TrailConnectionSchema.index({ userA: 1, isActive: 1, createdAt: -1 });
TrailConnectionSchema.index({ userB: 1, isActive: 1, createdAt: -1 });

// Pre-save hook to ensure userA < userB (normalize user order)
TrailConnectionSchema.pre('save', async function () {
  if (this.userA && this.userB) {
    const userAStr = String(this.userA);
    const userBStr = String(this.userB);
    if (userAStr > userBStr) {
      // Swap users to maintain consistent order
      [this.userA, this.userB] = [this.userB, this.userA];
    }
  }
});
