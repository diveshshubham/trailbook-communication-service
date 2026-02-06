# Migration Scripts

## migrate-delete-archive-fields.ts

One-time migration script to add `isDeleted` and `isArchived` fields to existing documents.

### What it does:
- Adds `isDeleted: false` to all Album documents that don't have this field
- Adds `isArchived: false` to all Album documents that don't have this field
- Adds `isDeleted: false` to all Media documents that don't have this field

### How to run:

```bash
npm run migrate:delete-archive-fields
```

Or directly with ts-node:

```bash
npx ts-node -r tsconfig-paths/register scripts/migrate-delete-archive-fields.ts
```

### Prerequisites:
- MongoDB connection string in `.env` file as `MONGO_URI` (or default: `mongodb://localhost:27017/trailbook`)
- The database should be accessible

### Output:
The script will show:
- Number of documents found without the fields
- Number of documents updated
- Final count of documents with the fields

### Safety:
- This script only adds fields with default values (`false`)
- It does NOT modify existing values if the fields already exist
- It's safe to run multiple times (idempotent)
