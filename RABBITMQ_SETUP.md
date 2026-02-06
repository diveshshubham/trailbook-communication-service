# RabbitMQ Setup Guide

This document explains the RabbitMQ integration for handling file uploads and Firebase notifications in the chat API.

## Architecture Overview

### Flow Diagram

```
User sends message (WebSocket)
    ↓
Save message to DB (synchronous)
    ↓
Emit WebSocket event (immediate)
    ↓
Publish to RabbitMQ (async)
    ├─→ chat.file.upload (if file attached)
    └─→ chat.notification.send (always)
```

### Queues

1. **`chat.file.upload`** - Handles file upload processing
   - Updates message with S3 file URL
   - Marks file as uploaded

2. **`chat.notification.send`** - Handles Firebase push notifications
   - Sends notifications to offline users
   - Retries on failure

3. **Dead Letter Queues (DLQ)**
   - `chat.file.upload.dlq` - Failed file uploads
   - `chat.notification.send.dlq` - Failed notifications

## Environment Variables

Add these to your `.env` file:

```env
# RabbitMQ Configuration
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest

# Or use full URL:
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

## Docker Setup

### Start Services

```bash
# Start MongoDB and RabbitMQ
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f rabbitmq
docker-compose logs -f mongodb
```

### RabbitMQ Management UI

Access the management UI at: http://localhost:15672

- Username: `guest` (or your RABBITMQ_USERNAME)
- Password: `guest` (or your RABBITMQ_PASSWORD)

You can:
- View queues and messages
- Monitor consumer activity
- Check dead letter queues
- Test message publishing

## Message Formats

### File Upload Message

```json
{
  "messageId": "507f1f77bcf86cd799439011",
  "fileKey": "chat/messages/507f1f77bcf86cd799439011/file-uuid.pdf",
  "fileName": "document.pdf",
  "contentType": "application/pdf",
  "size": 1024000,
  "senderId": "507f1f77bcf86cd799439012",
  "receiverId": "507f1f77bcf86cd799439013"
}
```

### Notification Message

```json
{
  "receiverId": "507f1f77bcf86cd799439013",
  "senderId": "507f1f77bcf86cd799439012",
  "messageId": "507f1f77bcf86cd799439011",
  "content": "Hello!",
  "hasFile": true,
  "fileName": "document.pdf",
  "fileType": "application/pdf"
}
```

## WebSocket Message Format

### Sending a Message with File

```javascript
socket.emit('send_message', {
  receiverId: '507f1f77bcf86cd799439013',
  content: 'Check out this file!',
  fileKey: 'chat/messages/507f1f77bcf86cd799439011/file-uuid.pdf',
  fileName: 'document.pdf',
  contentType: 'application/pdf',
  fileSize: 1024000
});
```

**Note:** The file should already be uploaded to S3 using a presigned URL before sending the message.

## File Upload Flow

1. **Client requests presigned URL** (you'll need to create this endpoint)
   - Endpoint: `GET /api/chat/presigned-url?contentType=application/pdf`
   - Returns: `{ uploadUrl, fileKey }`

2. **Client uploads file to S3** using presigned URL

3. **Client sends message via WebSocket** with file metadata

4. **Server saves message** (synchronously) with file metadata

5. **Server publishes to RabbitMQ** for file processing

6. **Consumer processes file** and updates message with S3 URL

## Supported File Types

All file types are supported:
- Images: `image/jpeg`, `image/png`, `image/webp`, etc.
- Documents: `application/pdf`, `application/msword`, etc.
- Text: `text/plain`, `text/csv`, etc.
- Any other MIME type

## Retry Logic

- **Max Retries:** 3 attempts
- **Backoff:** Exponential (1s, 2s, 4s)
- **DLQ:** Messages that fail after max retries go to dead letter queue

## Monitoring

### Check Queue Status

```bash
# Using RabbitMQ CLI (inside container)
docker exec -it trailbook-rabbitmq rabbitmqctl list_queues

# Or use Management UI
# http://localhost:15672
```

### View Dead Letter Queue

Messages in DLQ indicate processing failures. Check logs for details:

```bash
docker-compose logs -f | grep "DLQ\|Error"
```

## Firebase Notifications

The notification consumer is ready but requires Firebase credentials. When you have them:

1. Install Firebase Admin SDK:
   ```bash
   npm install firebase-admin
   ```

2. Update `src/modules/communication/consumers/notification.consumer.ts`
   - Uncomment the Firebase implementation
   - Add your Firebase credentials to `.env`

3. Add `fcmToken` field to UserProfile schema (if not exists)

## Troubleshooting

### RabbitMQ Connection Failed

```bash
# Check if RabbitMQ is running
docker-compose ps

# Check logs
docker-compose logs rabbitmq

# Restart RabbitMQ
docker-compose restart rabbitmq
```

### Messages Not Processing

1. Check consumer logs:
   ```bash
   npm run start:dev
   # Look for "✅ File upload consumer started"
   # Look for "✅ Notification consumer started"
   ```

2. Check queue in Management UI: http://localhost:15672

3. Verify message format matches expected schema

### File Upload Issues

- Ensure S3 bucket is configured correctly
- Check AWS credentials in `.env`
- Verify file was uploaded to S3 before sending message
- Check `AWS_S3_BUCKET` and `AWS_REGION` environment variables

## Next Steps

1. ✅ RabbitMQ infrastructure - **DONE**
2. ✅ File upload consumer - **DONE**
3. ✅ Notification consumer (placeholder) - **DONE**
4. ⏳ Create presigned URL endpoint for chat files
5. ⏳ Add Firebase credentials and implement notifications
6. ⏳ Add `fcmToken` to UserProfile schema
