# How to View Logs

This guide shows you how to view logs for RabbitMQ, MongoDB, and your NestJS application.

## 1. Docker Container Logs

### View All Container Logs

```bash
# View logs from all containers
docker-compose logs

# Follow logs in real-time (like tail -f)
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100
```

### View Specific Container Logs

```bash
# RabbitMQ logs
docker-compose logs rabbitmq

# MongoDB logs
docker-compose logs mongodb

# Follow RabbitMQ logs in real-time
docker-compose logs -f rabbitmq

# Follow MongoDB logs in real-time
docker-compose logs -f mongodb
```

### View Logs with Timestamps

```bash
# Add timestamps to logs
docker-compose logs -f --timestamps

# Specific container with timestamps
docker-compose logs -f --timestamps rabbitmq
```

### View Recent Logs Only

```bash
# Last 50 lines from RabbitMQ
docker-compose logs --tail=50 rabbitmq

# Last 100 lines from all containers
docker-compose logs --tail=100
```

## 2. NestJS Application Logs

### Development Mode

When running `npm run start:dev`, logs appear in your terminal:

```bash
npm run start:dev
```

You'll see:
- ✅ RabbitMQ connection logs
- ✅ Consumer startup logs
- ✅ Message processing logs
- ✅ Error logs

### Example Log Output

```
[RabbitMQProvider] Connecting to RabbitMQ: amqp://guest:****@localhost:5672
[RabbitMQProvider] ✅ RabbitMQ connected successfully
[RabbitMQProvider] ✅ RabbitMQ queues declared
[FileUploadConsumer] ✅ File upload consumer started on queue: chat.file.upload
[NotificationConsumer] ✅ Notification consumer started on queue: chat.notification.send
[ChatGateway] [handleSendMessage] Sending message: senderId=xxx, receiverId=yyy, hasFile=true
[RabbitMQService] Published file upload task: messageId=xxx, fileKey=yyy
[FileUploadConsumer] Processing file upload: messageId=xxx, fileKey=yyy
[FileUploadConsumer] ✅ File upload completed: messageId=xxx, fileUrl=https://...
```

### Production Mode

If running in production, logs go to stdout/stderr. You can redirect them:

```bash
# Save logs to file
npm run start:prod > app.log 2>&1

# View logs in real-time
npm run start:prod | tee app.log
```

## 3. RabbitMQ Management UI Logs

Access the Management UI at: **http://localhost:15672**

1. Login with credentials (default: guest/guest)
2. Go to **"Queues"** tab
3. Click on a queue name (e.g., `chat.file.upload`)
4. You'll see:
   - **Messages ready** - Waiting to be processed
   - **Messages unacknowledged** - Currently being processed
   - **Message rates** - Messages per second
   - **Consumer details** - Active consumers

### View Message Details

1. In the queue page, click **"Get messages"**
2. You can see message payloads
3. Check **"Dead Letter Queues"** for failed messages

## 4. Filtering and Searching Logs

### Search Docker Logs

```bash
# Search for errors in RabbitMQ logs
docker-compose logs rabbitmq | grep -i error

# Search for "connected" messages
docker-compose logs | grep -i connected

# Search for specific message ID
docker-compose logs | grep "messageId=507f1f77bcf86cd799439011"
```

### Search Application Logs

```bash
# If logs are in a file
grep -i "error" app.log
grep -i "rabbitmq" app.log
grep "FileUploadConsumer" app.log
```

## 5. Real-Time Monitoring

### Watch All Logs Simultaneously

Open multiple terminal windows:

**Terminal 1 - Docker Logs:**
```bash
docker-compose logs -f
```

**Terminal 2 - Application Logs:**
```bash
npm run start:dev
```

**Terminal 3 - Specific Container:**
```bash
docker-compose logs -f rabbitmq
```

### Using `multitail` (Optional)

If you have `multitail` installed:

```bash
multitail -s 2 \
  -l "docker-compose logs -f rabbitmq" \
  -l "docker-compose logs -f mongodb" \
  -l "npm run start:dev"
```

## 6. Common Log Patterns to Watch

### Successful Operations

```bash
# RabbitMQ connection
grep "RabbitMQ connected successfully"

# Consumer started
grep "consumer started on queue"

# Message published
grep "Published.*task"

# File upload completed
grep "File upload completed"

# Notification sent
grep "Notification sent successfully"
```

### Error Patterns

```bash
# Connection errors
grep -i "connection.*error\|failed to connect"

# Processing errors
grep -i "error processing\|failed to process"

# Retry attempts
grep -i "retrying\|retry"

# Dead letter queue
grep -i "dlq\|dead letter"
```

## 7. Log Levels in NestJS

Your application uses NestJS Logger with different log levels:

- `logger.log()` - Info messages (white)
- `logger.warn()` - Warnings (yellow)
- `logger.error()` - Errors (red)
- `logger.debug()` - Debug messages (only in debug mode)

### Enable Debug Logs

Set environment variable:
```bash
DEBUG=* npm run start:dev
```

Or in `.env`:
```env
DEBUG=*
```

## 8. Docker Container Status

Check if containers are running:

```bash
# List all containers
docker-compose ps

# Detailed status
docker ps

# Container health
docker inspect trailbook-rabbitmq | grep -A 10 Health
```

## 9. Quick Log Commands Cheat Sheet

```bash
# All logs, follow mode
docker-compose logs -f

# RabbitMQ only, last 50 lines
docker-compose logs --tail=50 rabbitmq

# Search for errors
docker-compose logs | grep -i error

# Application logs (dev mode)
npm run start:dev

# Application logs (prod, save to file)
npm run start:prod > app.log 2>&1

# View saved logs
tail -f app.log

# Search application logs
grep "RabbitMQ" app.log
```

## 10. Troubleshooting with Logs

### RabbitMQ Not Connecting

```bash
# Check RabbitMQ container logs
docker-compose logs rabbitmq | grep -i error

# Check if container is running
docker-compose ps rabbitmq

# Check connection attempts in app logs
npm run start:dev | grep -i rabbitmq
```

### Messages Not Processing

```bash
# Check consumer logs
npm run start:dev | grep -i consumer

# Check queue status in Management UI
# http://localhost:15672 -> Queues

# Check for errors
docker-compose logs rabbitmq | grep -i error
```

### File Upload Issues

```bash
# Check file upload consumer
npm run start:dev | grep "FileUploadConsumer"

# Check S3 errors
npm run start:dev | grep -i s3

# Check message format
# Go to RabbitMQ Management UI -> Queues -> chat.file.upload -> Get messages
```

## 11. Log Rotation (Production)

For production, consider log rotation:

```bash
# Using logrotate (Linux)
# Create /etc/logrotate.d/trailbook
/path/to/app.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

Or use Docker logging drivers:
```yaml
# In docker-compose.yml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```
