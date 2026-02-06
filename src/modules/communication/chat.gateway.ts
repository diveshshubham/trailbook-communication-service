import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessageService } from './message.service';
import { ConnectionRequestService } from './connection-request.service';
import { RabbitMQService } from '../../common/rabbitmq/rabbitmq.service';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private readonly messageService: MessageService,
    private readonly connectionRequestService: ConnectionRequestService,
    private readonly jwtService: JwtService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Authenticate user from handshake
      const token = client.handshake.auth?.token || 
                   client.handshake.headers?.authorization?.split(' ')[1] ||
                   client.handshake.query?.token as string;

      if (!token) {
        this.logger.warn(`[handleConnection] No token provided, disconnecting`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      let user;
      try {
        user = this.jwtService.verify(token);
      } catch (error) {
        this.logger.warn(`[handleConnection] Invalid token, disconnecting`);
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      if (!user || !user.sub) {
        this.logger.warn(`[handleConnection] Invalid user payload, disconnecting`);
        client.emit('error', { message: 'Invalid user' });
        client.disconnect();
        return;
      }

      const userId = user.sub;
      (client as any).user = user;
      (client as any).userId = userId;

      // Store connection (allow multiple connections per user)
      this.connectedUsers.set(userId, client.id);
      this.logger.log(`[handleConnection] User connected: ${userId} (socket: ${client.id})`);

      // Join a room for this user
      await client.join(`user:${userId}`);

      // Notify user that they're connected
      client.emit('connected', { userId, message: 'Connected to chat server' });
    } catch (error) {
      this.logger.error(`[handleConnection] Error:`, error);
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = (client as any).userId;
      if (userId) {
        // Only remove if this is the last connection for this user
        const currentSocketId = this.connectedUsers.get(userId);
        if (currentSocketId === client.id) {
          this.connectedUsers.delete(userId);
          this.logger.log(`[handleDisconnect] User disconnected: ${userId} (socket: ${client.id})`);
        }
      }
    } catch (error) {
      this.logger.error(`[handleDisconnect] Error:`, error);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { 
      receiverId: string; 
      content: string;
      fileKey?: string;
      fileName?: string;
      contentType?: string;
      fileSize?: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = (client as any).user;
      if (!user || !user.sub) {
        client.emit('error', { message: 'Unauthorized' });
        return;
      }

      const senderId = user.sub;
      const { receiverId, content, fileKey, fileName, contentType, fileSize } = data;

      if (!receiverId || !content) {
        client.emit('error', { message: 'receiverId and content are required' });
        return;
      }

      this.logger.log(
        `[handleSendMessage] Sending message: senderId=${senderId}, receiverId=${receiverId}, hasFile=${!!fileKey}`,
      );

      // Prepare file data if file is attached
      const fileData = fileKey && fileName && contentType && fileSize
        ? { fileKey, fileName, contentType, size: fileSize }
        : undefined;

      // Validate and save message (synchronously)
      const message = await this.messageService.sendMessage(
        senderId,
        receiverId,
        content,
        fileData,
      );

      const messagePayload = {
        _id: message.messageId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        hasFile: message.hasFile || false,
        fileKey: message.fileKey,
        fileName: message.fileName,
        fileType: message.fileType,
        fileSize: message.fileSize,
        fileUrl: undefined, // Will be updated by consumer
        isFileUploaded: false,
        createdAt: message.createdAt,
        isRead: false,
      };

      // Publish to RabbitMQ queues (async)
      try {
        // Publish file upload task if file is attached
        if (fileData) {
          await this.rabbitMQService.publishFileUpload({
            messageId: String(message.messageId),
            fileKey: fileData.fileKey,
            fileName: fileData.fileName,
            contentType: fileData.contentType,
            size: fileData.size,
            senderId,
            receiverId,
          });
        }

        // Always publish notification task
        await this.rabbitMQService.publishNotification({
          receiverId,
          senderId,
          messageId: String(message.messageId),
          content,
          hasFile: !!fileData,
          fileName: fileData?.fileName,
          fileType: fileData?.contentType,
        });
      } catch (rabbitError) {
        // Log but don't fail the message send
        this.logger.error(`[handleSendMessage] Failed to publish to RabbitMQ:`, rabbitError);
      }

      // Send to receiver (broadcast to all their connected clients)
      this.server.to(`user:${receiverId}`).emit('new_message', {
        message: messagePayload,
      });

      // Confirm to sender
      client.emit('message_sent', {
        message: messagePayload,
      });

      this.logger.log(`[handleSendMessage] Message sent successfully: ${message.messageId}`);
    } catch (error) {
      this.logger.error(`[handleSendMessage] Error:`, error);
      client.emit('error', {
        message: error instanceof Error ? error.message : 'Failed to send message',
      });
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { receiverId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = (client as any).user;
      if (!user || !user.sub) {
        return;
      }

      const senderId = user.sub;
      const { receiverId, isTyping } = data;

      if (!receiverId) {
        return;
      }

      this.logger.debug(
        `[handleTyping] User ${senderId} is ${isTyping ? 'typing' : 'stopped typing'} to ${receiverId}`,
      );

      // Notify receiver that sender is typing (broadcast to all their connected clients)
      this.server.to(`user:${receiverId}`).emit('user_typing', {
        userId: senderId,
        isTyping: isTyping === true,
      });
    } catch (error) {
      this.logger.error(`[handleTyping] Error:`, error);
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @MessageBody() data: { senderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = (client as any).user;
      if (!user || !user.sub) {
        return;
      }

      const receiverId = user.sub;
      const { senderId } = data;

      // This is handled in the message service when fetching messages
      // But we can emit a confirmation if needed
      client.emit('messages_read', { senderId });
    } catch (error) {
      this.logger.error(`[handleMarkRead] Error:`, error);
    }
  }

  /**
   * Get online status of a user
   */
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get socket ID for a user
   */
  getSocketId(userId: string): string | undefined {
    return this.connectedUsers.get(userId);
  }
}
