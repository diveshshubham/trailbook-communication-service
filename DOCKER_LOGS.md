# Viewing Application Logs in Docker

This guide shows you how to see your NestJS application logs (like `npm run start:dev`) when running in Docker.

## Quick Commands

### View Application Logs (Like npm run start:dev)

```bash
# View app logs in real-time (follow mode)
docker-compose logs -f app

# View last 100 lines
docker-compose logs --tail=100 app

# View all logs (app + mongodb + rabbitmq)
docker-compose logs -f
```

## Setup

### 1. Start All Services

```bash
# Build and start all services (app, mongodb, rabbitmq)
docker-compose up --build

# Or start in detached mode (background)
docker-compose up -d --build

# Then follow logs
docker-compose logs -f app
```

### 2. View Logs in Real-Time

```bash
# Application logs only (most important)
docker-compose logs -f app

# You'll see output like:
# [Nest] Starting Nest application...
# [RabbitMQProvider] Connecting to RabbitMQ...
# [FileUploadConsumer] ✅ File upload consumer started
# [ChatGateway] [handleSendMessage] Sending message...
```

## Different Log Views

### View All Services Together

```bash
# All services, real-time
docker-compose logs -f

# All services, last 50 lines
docker-compose logs --tail=50
```

### View Specific Service

```bash
# Application
docker-compose logs -f app

# MongoDB
docker-compose logs -f mongodb

# RabbitMQ
docker-compose logs -f rabbitmq
```

### View with Timestamps

```bash
# Add timestamps to logs
docker-compose logs -f --timestamps app
```

## Development Workflow

### Option 1: Run App in Docker (Recommended for Full Stack)

```bash
# Start all services
docker-compose up --build

# In another terminal, follow app logs
docker-compose logs -f app
```

**Benefits:**
- ✅ All services (app, MongoDB, RabbitMQ) in one place
- ✅ Easy to see all logs together
- ✅ Hot-reload works (code changes auto-reload)

### Option 2: Run App Locally, Services in Docker

```bash
# Terminal 1: Start only services
docker-compose up mongodb rabbitmq

# Terminal 2: Run app locally (see logs directly)
npm run start:dev
```

**Benefits:**
- ✅ See logs directly in terminal (no docker logs command)
- ✅ Faster development cycle
- ✅ Better debugging experience

## Log Examples

### What You'll See

```
trailbook-app  | [Nest] 12345  - 01/15/2024, 10:30:45 AM   LOG [NestFactory] Starting Nest application...
trailbook-app  | [Nest] 12345  - 01/15/2024, 10:30:45 AM   LOG [InstanceLoader] AppModule dependencies initialized
trailbook-app  | [RabbitMQProvider] Connecting to RabbitMQ: amqp://guest:****@rabbitmq:5672
trailbook-app  | [RabbitMQProvider] ✅ RabbitMQ connected successfully
trailbook-app  | [FileUploadConsumer] ✅ File upload consumer started on queue: chat.file.upload
trailbook-app  | [NotificationConsumer] ✅ Notification consumer started on queue: chat.notification.send
trailbook-app  | [Nest] 12345  - 01/15/2024, 10:30:46 AM   LOG [NestApplication] Nest application successfully started
trailbook-app  | 🚀 Server started on http://localhost:3008/api
trailbook-app  | [ChatGateway] [handleSendMessage] Sending message: senderId=xxx, receiverId=yyy
trailbook-app  | [RabbitMQService] Published file upload task: messageId=xxx
```

## Filtering Logs

### Search for Specific Terms

```bash
# Search for errors
docker-compose logs app | grep -i error

# Search for RabbitMQ
docker-compose logs app | grep -i rabbitmq

# Search for specific message
docker-compose logs app | grep "messageId=507f1f77bcf86cd799439011"

# Search for consumer activity
docker-compose logs app | grep -i consumer
```

### View Only Errors

```bash
# Filter errors from all services
docker-compose logs | grep -i error

# Filter errors from app only
docker-compose logs app | grep -i error
```

## Troubleshooting

### No Logs Appearing

```bash
# Check if container is running
docker-compose ps

# Check container status
docker ps | grep trailbook-app

# Restart the app container
docker-compose restart app

# Rebuild and restart
docker-compose up --build -d app
```

### Logs Not Updating

```bash
# Make sure you're using -f (follow) flag
docker-compose logs -f app

# Check if app is actually running
docker-compose ps app
```

### See Container Output Directly

```bash
# Attach to container (see output directly)
docker attach trailbook-app

# Press Ctrl+P, Ctrl+Q to detach without stopping container
```

## Production vs Development

### Development (Current Setup)

- Uses `Dockerfile.dev`
- Runs `npm run start:dev` (hot-reload)
- Source code mounted as volume (changes reflect immediately)
- Full logs with colors and formatting

### Production

```bash
# Use production Dockerfile
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

## Best Practice: Multiple Terminals

Open 3 terminals for best experience:

**Terminal 1 - App Logs:**
```bash
docker-compose logs -f app
```

**Terminal 2 - All Services:**
```bash
docker-compose logs -f mongodb rabbitmq
```

**Terminal 3 - Commands:**
```bash
# Run your commands here
docker-compose restart app
# etc.
```

## Quick Reference

```bash
# Most common: View app logs
docker-compose logs -f app

# View all logs
docker-compose logs -f

# Search logs
docker-compose logs app | grep "error"

# Last 50 lines
docker-compose logs --tail=50 app

# With timestamps
docker-compose logs -f --timestamps app
```
