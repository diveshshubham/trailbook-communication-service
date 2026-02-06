# Communication Service API - cURL Commands

Base URL: `http://localhost:3008/api`

**Note:** Replace `YOUR_JWT_TOKEN` with your actual JWT token in all requests.

---

## Connection Request APIs

### 1. Send Connection Request
```bash
curl -X POST "http://localhost:3008/api/connection-requests/send/USER_ID_TO_CONNECT" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Example:**
```bash
curl -X POST "http://localhost:3008/api/connection-requests/send/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

### 2. Accept Connection Request
```bash
curl -X PUT "http://localhost:3008/api/connection-requests/accept/REQUEST_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Example:**
```bash
curl -X PUT "http://localhost:3008/api/connection-requests/accept/507f1f77bcf86cd799439012" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

### 3. Reject Connection Request
```bash
curl -X PUT "http://localhost:3008/api/connection-requests/reject/REQUEST_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Example:**
```bash
curl -X PUT "http://localhost:3008/api/connection-requests/reject/507f1f77bcf86cd799439012" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

### 4. Get Connected People
```bash
curl -X GET "http://localhost:3008/api/connection-requests/connected" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Example:**
```bash
curl -X GET "http://localhost:3008/api/connection-requests/connected" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

### 5. Get Rejected People
```bash
curl -X GET "http://localhost:3008/api/connection-requests/rejected" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Example:**
```bash
curl -X GET "http://localhost:3008/api/connection-requests/rejected" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

### 6. Get Pending Requests
```bash
curl -X GET "http://localhost:3008/api/connection-requests/pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Example:**
```bash
curl -X GET "http://localhost:3008/api/connection-requests/pending" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

## Message/Chat APIs

### 7. Send Message
```bash
curl -X POST "http://localhost:3008/api/messages/send" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receiverId": "USER_ID_TO_SEND_MESSAGE_TO",
    "content": "Your message content here"
  }'
```

**Example:**
```bash
curl -X POST "http://localhost:3008/api/messages/send" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "receiverId": "507f1f77bcf86cd799439011",
    "content": "Hello! How are you?"
  }'
```

---

### 8. Get Messages with a User (Cursor-based Pagination)
```bash
curl -X GET "http://localhost:3008/api/messages/with/USER_ID?cursor=CURSOR_ID&limit=50&direction=before" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Query Parameters:**
- `cursor` (optional): Message ID to start from. Omit for initial load (gets latest messages)
- `limit` (optional, default: 50, max: 100): Number of messages to fetch
- `direction` (optional, default: 'before'): 
  - `before`: Get older messages (scroll up/load history)
  - `after`: Get newer messages (load new messages after cursor)

**Example:**
```bash
# Get initial messages (latest 50 messages)
curl -X GET "http://localhost:3008/api/messages/with/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"

# Load older messages (scroll up) - use cursor from previous response
curl -X GET "http://localhost:3008/api/messages/with/507f1f77bcf86cd799439011?cursor=507f1f77bcf86cd799439012&limit=50&direction=before" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"

# Load newer messages (after a specific message)
curl -X GET "http://localhost:3008/api/messages/with/507f1f77bcf86cd799439011?cursor=507f1f77bcf86cd799439012&limit=50&direction=after" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response Format:**
```json
{
  "success": true,
  "message": "Messages fetched",
  "data": {
    "messages": [
      {
        "_id": "message_id",
        "senderId": "user_id",
        "receiverId": "user_id",
        "content": "Message content",
        "isRead": true,
        "readAt": "2024-01-01T00:00:00.000Z",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "nextCursor": "message_id_for_next_page",
    "hasMore": true,
    "direction": "before"
  }
}
```

---

### 9. Get All Conversations
```bash
curl -X GET "http://localhost:3008/api/messages/conversations" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Example:**
```bash
curl -X GET "http://localhost:3008/api/messages/conversations" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

### 10. Get Unread Message Count
```bash
curl -X GET "http://localhost:3008/api/messages/unread-count" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Example:**
```bash
curl -X GET "http://localhost:3008/api/messages/unread-count" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

## WebSocket Connection

### Connect to WebSocket Chat Server

**Using Socket.IO Client (JavaScript/TypeScript):**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3008/chat', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  },
  // Alternative methods to pass token:
  // Method 1: via query parameter
  // query: { token: 'YOUR_JWT_TOKEN' }
  // Method 2: via Authorization header (if supported by your client)
  // extraHeaders: {
  //   Authorization: 'Bearer YOUR_JWT_TOKEN'
  // }
});

// Listen for connection confirmation
socket.on('connected', (data) => {
  console.log('Connected:', data);
});

// Send a message
socket.emit('send_message', {
  receiverId: 'USER_ID',
  content: 'Hello from WebSocket!'
});

// Listen for new messages
socket.on('new_message', (data) => {
  console.log('New message received:', data.message);
});

// Listen for message sent confirmation
socket.on('message_sent', (data) => {
  console.log('Message sent:', data.message);
});

// Send typing indicator (call this when user starts typing)
socket.emit('typing', {
  receiverId: 'USER_ID',
  isTyping: true
});

// Stop typing indicator (call this when user stops typing)
socket.emit('typing', {
  receiverId: 'USER_ID',
  isTyping: false
});

// Listen for typing indicators
socket.on('user_typing', (data) => {
  console.log('User typing:', data.userId, data.isTyping);
});

// Mark messages as read
socket.emit('mark_read', {
  senderId: 'USER_ID'
});

// Listen for read confirmation
socket.on('messages_read', (data) => {
  console.log('Messages marked as read:', data.senderId);
});

// Handle errors
socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Handle disconnection
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

**Using wscat (Command Line Tool):**
```bash
# Install wscat: npm install -g wscat

# Connect (Note: WebSocket authentication may need to be handled differently)
wscat -c "ws://localhost:3008/chat" -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Response Format

All API responses follow this format:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful message",
  "data": {
    // Response data here
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message",
  "error": {
    // Error details
  }
}
```

---

## Quick Test Sequence

1. **Get your JWT token** (from login/auth endpoint)
2. **Send a connection request:**
   ```bash
   curl -X POST "http://localhost:3008/api/connection-requests/send/USER_ID" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```
3. **Check pending requests** (as the recipient):
   ```bash
   curl -X GET "http://localhost:3008/api/connection-requests/pending" \
     -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"
   ```
4. **Accept the request:**
   ```bash
   curl -X PUT "http://localhost:3008/api/connection-requests/accept/REQUEST_ID" \
     -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"
   ```
5. **Send a message:**
   ```bash
   curl -X POST "http://localhost:3008/api/messages/send" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"receiverId": "USER_ID", "content": "Hello!"}'
   ```
6. **Get messages (initial load):**
   ```bash
   curl -X GET "http://localhost:3008/api/messages/with/USER_ID" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

7. **Load older messages (scroll up) - use nextCursor from previous response:**
   ```bash
   curl -X GET "http://localhost:3008/api/messages/with/USER_ID?cursor=MESSAGE_ID&direction=before" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

---

## Notes

- All endpoints require JWT authentication via `Authorization: Bearer <token>` header
- User IDs should be valid MongoDB ObjectIds
- Messages can only be sent between users who have accepted connection requests
- WebSocket connections require JWT token in the `auth.token` field or `Authorization` header
- Cursor-based pagination for messages (optimized for real-time chat)
  - Default: limit=50, max=100 messages per request
  - Use `cursor` parameter for pagination (message ID)
  - Use `direction=before` for older messages, `direction=after` for newer messages
