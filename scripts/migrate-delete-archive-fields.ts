/**
 * One-time migration script to add isDeleted and isArchived fields
 * to existing Album and Media documents in the database.
 * 
 * Run with: npx ts-node scripts/migrate-delete-archive-fields.ts
 */

import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env file if it exists
// Using process.cwd() for compatibility with ts-node
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
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (error) {
  // .env file not found or can't be read, use existing env vars
  console.log('⚠️  .env file not found, using existing environment variables');
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/trailbook';

interface MigrationResult {
  albumsUpdated: number;
  mediaUpdated: number;
  albumsWithIsDeleted: number;
  albumsWithIsArchived: number;
  mediaWithIsDeleted: number;
}

async function migrate() {
  console.log('🟡 Starting migration...');
  console.log(`📡 Connecting to MongoDB: ${MONGO_URI.replace(/\/\/.*@/, '//***@')}`);

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('🟢 Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result: MigrationResult = {
      albumsUpdated: 0,
      mediaUpdated: 0,
      albumsWithIsDeleted: 0,
      albumsWithIsArchived: 0,
      mediaWithIsDeleted: 0,
    };

    // ============================================
    // Migrate Albums Collection
    // ============================================
    console.log('\n📦 Migrating Albums collection...');
    const albumsCollection = db.collection('albums');

    // Count albums without isDeleted field
    const albumsWithoutIsDeleted = await albumsCollection.countDocuments({
      isDeleted: { $exists: false },
    });

    // Count albums without isArchived field
    const albumsWithoutIsArchived = await albumsCollection.countDocuments({
      isArchived: { $exists: false },
    });

    console.log(`   Found ${albumsWithoutIsDeleted} albums without isDeleted field`);
    console.log(`   Found ${albumsWithoutIsArchived} albums without isArchived field`);

    // Update albums missing isDeleted
    if (albumsWithoutIsDeleted > 0) {
      const updateResult1 = await albumsCollection.updateMany(
        { isDeleted: { $exists: false } },
        { $set: { isDeleted: false } },
      );
      result.albumsUpdated += updateResult1.modifiedCount;
      console.log(`   ✅ Set isDeleted: false on ${updateResult1.modifiedCount} albums`);
    }

    // Update albums missing isArchived
    if (albumsWithoutIsArchived > 0) {
      const updateResult2 = await albumsCollection.updateMany(
        { isArchived: { $exists: false } },
        { $set: { isArchived: false } },
      );
      result.albumsUpdated += updateResult2.modifiedCount;
      console.log(`   ✅ Set isArchived: false on ${updateResult2.modifiedCount} albums`);
    }

    // Count final state
    result.albumsWithIsDeleted = await albumsCollection.countDocuments({
      isDeleted: { $exists: true },
    });
    result.albumsWithIsArchived = await albumsCollection.countDocuments({
      isArchived: { $exists: true },
    });

    // ============================================
    // Migrate Media Collection
    // ============================================
    console.log('\n📸 Migrating Media collection...');
    const mediaCollection = db.collection('media');

    // Count media without isDeleted field
    const mediaWithoutIsDeleted = await mediaCollection.countDocuments({
      isDeleted: { $exists: false },
    });

    console.log(`   Found ${mediaWithoutIsDeleted} media items without isDeleted field`);

    // Update media missing isDeleted
    if (mediaWithoutIsDeleted > 0) {
      const updateResult = await mediaCollection.updateMany(
        { isDeleted: { $exists: false } },
        { $set: { isDeleted: false } },
      );
      result.mediaUpdated = updateResult.modifiedCount;
      console.log(`   ✅ Set isDeleted: false on ${updateResult.modifiedCount} media items`);
    }

    // Count final state
    result.mediaWithIsDeleted = await mediaCollection.countDocuments({
      isDeleted: { $exists: true },
    });

    // ============================================
    // Summary
    // ============================================
    console.log('\n📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Albums:`);
    console.log(`  - Updated: ${result.albumsUpdated} documents`);
    console.log(`  - With isDeleted field: ${result.albumsWithIsDeleted}`);
    console.log(`  - With isArchived field: ${result.albumsWithIsArchived}`);
    console.log(`\nMedia:`);
    console.log(`  - Updated: ${result.mediaUpdated} documents`);
    console.log(`  - With isDeleted field: ${result.mediaWithIsDeleted}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
migrate().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
