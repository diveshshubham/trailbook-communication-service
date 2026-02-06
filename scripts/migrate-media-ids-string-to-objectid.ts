/**
 * One-time migration script:
 * Convert legacy Media fields from string -> ObjectId:
 * - media.albumId (string)  -> ObjectId
 * - media.userId  (string)  -> ObjectId
 *
 * Why:
 * - Some older media documents may have albumId/userId stored as strings.
 * - Newer code expects ObjectId for joins/queries.
 *
 * Safety:
 * - Only converts when the value is a 24-hex string.
 * - Leaves existing ObjectIds (and non-matching strings) untouched.
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-media-ids-string-to-objectid.ts
 */

import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env file if it exists (no external deps)
try {
  const envPath = resolve(process.cwd(), '.env');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const match = trimmedLine.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  });
} catch {
  // ignore
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/trailbook';

const HEX_24 = '^[0-9a-fA-F]{24}$';

async function main() {
  // eslint-disable-next-line no-console
  console.log('🟡 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const media = db.collection('media');

    const albumIdFilter = {
      albumId: { $type: 'string', $regex: HEX_24 },
    };
    const userIdFilter = {
      userId: { $type: 'string', $regex: HEX_24 },
    };

    const albumIdBefore = await media.countDocuments(albumIdFilter as any);
    const userIdBefore = await media.countDocuments(userIdFilter as any);

    // eslint-disable-next-line no-console
    console.log(`Found ${albumIdBefore} media docs with string albumId to convert`);
    // eslint-disable-next-line no-console
    console.log(`Found ${userIdBefore} media docs with string userId to convert`);

    if (albumIdBefore > 0) {
      const res = await media.updateMany(
        albumIdFilter as any,
        [{ $set: { albumId: { $toObjectId: '$albumId' } } }] as any,
      );
      // eslint-disable-next-line no-console
      console.log(`✅ Converted albumId in ${res.modifiedCount} media docs`);
    }

    if (userIdBefore > 0) {
      const res = await media.updateMany(
        userIdFilter as any,
        [{ $set: { userId: { $toObjectId: '$userId' } } }] as any,
      );
      // eslint-disable-next-line no-console
      console.log(`✅ Converted userId in ${res.modifiedCount} media docs`);
    }

    const albumIdAfter = await media.countDocuments(albumIdFilter as any);
    const userIdAfter = await media.countDocuments(userIdFilter as any);

    // eslint-disable-next-line no-console
    console.log(`Remaining media docs with string albumId: ${albumIdAfter}`);
    // eslint-disable-next-line no-console
    console.log(`Remaining media docs with string userId: ${userIdAfter}`);
  } finally {
    await mongoose.disconnect();
    // eslint-disable-next-line no-console
    console.log('🔌 Disconnected');
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ Migration failed:', e);
  process.exit(1);
});

