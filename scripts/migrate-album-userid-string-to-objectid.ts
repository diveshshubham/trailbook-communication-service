/**
 * One-time migration script:
 * Convert `albums.userId` from string -> ObjectId for legacy records.
 *
 * Why:
 * - Some older album documents may have userId stored as a string.
 * - Newer code expects ObjectId (and queries may cast).
 *
 * Safe:
 * - Only converts when userId is a 24-hex string.
 * - Leaves non-matching values untouched.
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-album-userid-string-to-objectid.ts
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

async function main() {
  // eslint-disable-next-line no-console
  console.log('🟡 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const albums = db.collection('albums');

    const filter = {
      userId: { $type: 'string', $regex: '^[0-9a-fA-F]{24}$' },
    };

    const before = await albums.countDocuments(filter as any);
    // eslint-disable-next-line no-console
    console.log(`Found ${before} albums with string userId to convert`);

    if (before === 0) return;

    // Use an update pipeline so we can convert from the existing field value
    const res = await albums.updateMany(
      filter as any,
      [{ $set: { userId: { $toObjectId: '$userId' } } }] as any,
    );

    // eslint-disable-next-line no-console
    console.log(`Updated ${res.modifiedCount} albums`);

    const after = await albums.countDocuments(filter as any);
    // eslint-disable-next-line no-console
    console.log(`Remaining albums with string userId: ${after}`);
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

