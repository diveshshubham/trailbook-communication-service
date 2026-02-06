import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from '../../models/message.schema';
import { ConnectionRequestService } from './connection-request.service';
import { UserProfile, UserProfileDocument } from '../../models/user-profile.schema';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<MessageDocument>,
    @InjectModel(UserProfile.name)
    private userProfileModel: Model<UserProfileDocument>,
    private connectionRequestService: ConnectionRequestService,
  ) {}

  /**
   * Send a message (only if users are connected)
   */
  async sendMessage(
    senderId: string,
    receiverId: string,
    content: string,
    fileData?: {
      fileKey: string;
      fileName: string;
      contentType: string;
      size: number;
    },
  ) {
    try {
      this.logger.log(
        `[sendMessage] Sending message: senderId=${senderId}, receiverId=${receiverId}, hasFile=${!!fileData}`,
      );

      if (!Types.ObjectId.isValid(senderId) || !Types.ObjectId.isValid(receiverId)) {
        throw new BadRequestException('Invalid userId');
      }

      if (senderId === receiverId) {
        throw new BadRequestException('Cannot send message to yourself');
      }

      // Check if users are connected
      const areConnected = await this.connectionRequestService.areConnected(
        senderId,
        receiverId,
      );

      if (!areConnected) {
        throw new BadRequestException('Users must be connected to send messages');
      }

      const senderObjectId = new Types.ObjectId(senderId);
      const receiverObjectId = new Types.ObjectId(receiverId);

      const message = await this.messageModel.create({
        senderId: senderObjectId,
        receiverId: receiverObjectId,
        content,
        hasFile: !!fileData,
        fileKey: fileData?.fileKey,
        fileName: fileData?.fileName,
        fileType: fileData?.contentType,
        fileSize: fileData?.size,
        isFileUploaded: false, // Will be updated by consumer
        isRead: false,
      });

      this.logger.log(`[sendMessage] Message created: ${message._id}`);
      return {
        messageId: message._id,
        senderId,
        receiverId,
        content,
        hasFile: !!fileData,
        fileKey: fileData?.fileKey,
        fileName: fileData?.fileName,
        fileType: fileData?.contentType,
        fileSize: fileData?.size,
        createdAt: message.createdAt,
      };
    } catch (error) {
      this.logger.error(`[sendMessage] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get messages between two users (cursor-based pagination)
   * Optimized for real-time chat with efficient cursor-based pagination
   */
  async getMessages(
    userId: string,
    otherUserId: string,
    cursor?: string,
    limit: number = 50,
    direction: 'before' | 'after' = 'before',
  ) {
    try {
      this.logger.log(
        `[getMessages] Fetching messages: userId=${userId}, otherUserId=${otherUserId}, cursor=${cursor}, limit=${limit}, direction=${direction}`,
      );

      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(otherUserId)) {
        throw new BadRequestException('Invalid userId');
      }

      // Validate limit
      if (limit < 1 || limit > 100) {
        throw new BadRequestException('Limit must be between 1 and 100');
      }

      // Check if users are connected
      const areConnected = await this.connectionRequestService.areConnected(
        userId,
        otherUserId,
      );

      if (!areConnected) {
        throw new BadRequestException('Users must be connected to view messages');
      }

      const userIdObjectId = new Types.ObjectId(userId);
      const otherUserIdObjectId = new Types.ObjectId(otherUserId);

      // Build query with cursor-based pagination
      const baseQuery: any = {
        $or: [
          { senderId: userIdObjectId, receiverId: otherUserIdObjectId },
          { senderId: otherUserIdObjectId, receiverId: userIdObjectId },
        ],
      };

      // Add cursor condition for pagination
      if (cursor) {
        if (!Types.ObjectId.isValid(cursor)) {
          throw new BadRequestException('Invalid cursor');
        }

        const cursorObjectId = new Types.ObjectId(cursor);
        
        // Get the cursor message to use its createdAt for comparison
        const cursorMessage = await this.messageModel
          .findById(cursorObjectId)
          .select('createdAt')
          .lean();

        if (!cursorMessage) {
          throw new BadRequestException('Cursor message not found');
        }

        if (direction === 'before') {
          // Get messages before (older than) the cursor
          baseQuery.createdAt = { $lt: cursorMessage.createdAt };
        } else {
          // Get messages after (newer than) the cursor
          baseQuery.createdAt = { $gt: cursorMessage.createdAt };
        }
      }

      // Fetch one extra to check if there are more messages
      const messages = await this.messageModel
        .find(baseQuery)
        .sort(direction === 'before' ? { createdAt: -1 } : { createdAt: 1 })
        .limit(limit + 1) // Fetch one extra to determine hasMore
        .lean();

      // Check if there are more messages
      const hasMore = messages.length > limit;
      const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

      // Reverse if direction is 'before' to get chronological order (oldest to newest)
      const sortedMessages = direction === 'before' 
        ? messagesToReturn.reverse() 
        : messagesToReturn;

      // Mark messages as read (only messages received by the current user)
      const unreadMessageIds = sortedMessages
        .filter(
          (msg) =>
            String(msg.receiverId) === userId && !msg.isRead,
        )
        .map((msg) => msg._id);

      if (unreadMessageIds.length > 0) {
        await this.messageModel.updateMany(
          { _id: { $in: unreadMessageIds } },
          { isRead: true, readAt: new Date() },
        );
      }

      // Format response
      const result = sortedMessages.map((msg) => ({
        _id: msg._id,
        senderId: String(msg.senderId),
        receiverId: String(msg.receiverId),
        content: msg.content,
        hasFile: msg.hasFile || false,
        fileKey: msg.fileKey,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileType: msg.fileType,
        fileSize: msg.fileSize,
        isFileUploaded: msg.isFileUploaded || false,
        isRead: String(msg.receiverId) === userId ? msg.isRead : true, // Always true for sent messages
        readAt: msg.readAt,
        createdAt: msg.createdAt,
      }));

      // Determine next cursor (for pagination)
      const nextCursor = result.length > 0 
        ? (direction === 'before' ? result[0]._id : result[result.length - 1]._id)
        : null;

      this.logger.log(
        `[getMessages] Found ${result.length} messages for userId: ${userId}, hasMore: ${hasMore}`,
      );

      return {
        messages: result,
        nextCursor,
        hasMore,
        direction,
      };
    } catch (error) {
      this.logger.error(`[getMessages] Error:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch messages: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadCount(userId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);

      const count = await this.messageModel.countDocuments({
        receiverId: userIdObjectId,
        isRead: false,
      });

      return { unreadCount: count };
    } catch (error) {
      this.logger.error(`[getUnreadCount] Error:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to get unread count: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all conversations (list of users with recent messages)
   */
  async getConversations(userId: string) {
    try {
      this.logger.log(`[getConversations] Fetching for userId: ${userId}`);

      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);

      // Get all unique users the current user has messaged with
      const messages = await this.messageModel
        .find({
          $or: [
            { senderId: userIdObjectId },
            { receiverId: userIdObjectId },
          ],
        })
        .sort({ createdAt: -1 })
        .lean();

      // Get unique user IDs
      const otherUserIds = new Set<string>();
      messages.forEach((msg) => {
        const senderStr = String(msg.senderId);
        const receiverStr = String(msg.receiverId);
        if (senderStr === userId) {
          otherUserIds.add(receiverStr);
        } else {
          otherUserIds.add(senderStr);
        }
      });

      // Get user profiles - ensure ObjectIds are properly converted
      // Convert all IDs to ObjectId format for query
      const otherUserObjectIds = Array.from(otherUserIds).map((id) => new Types.ObjectId(String(id)));
      const otherUserStrings = Array.from(otherUserIds).map((id) => String(id));
      
      // Query with both ObjectId and string formats for compatibility
      const userProfiles = await this.userProfileModel
        .find({
          $or: [
            { userId: { $in: otherUserObjectIds } },
            { userId: { $in: otherUserStrings } }, // Handle string format (backward compatibility)
          ],
        })
        .select('userId fullName bio profilePicture location')
        .lean();

      this.logger.debug(
        `[getConversations] Found ${userProfiles.length} profiles out of ${otherUserIds.size} user IDs`,
      );

      const profileMap = new Map();
      userProfiles.forEach((profile) => {
        const profileUserIdStr = String(profile.userId);
        profileMap.set(profileUserIdStr, {
          userId: profileUserIdStr,
          fullName: profile.fullName,
          bio: profile.bio,
          profilePicture: profile.profilePicture,
          location: profile.location,
        });
        this.logger.debug(
          `[getConversations] Added profile for userId: ${profileUserIdStr}`,
        );
      });

      // Get latest message and unread count for each conversation
      const conversations = Array.from(otherUserIds).map((otherUserId) => {
        const otherUserIdObjectId = new Types.ObjectId(otherUserId);
        const conversationMessages = messages.filter(
          (msg) =>
            (String(msg.senderId) === userId && String(msg.receiverId) === otherUserId) ||
            (String(msg.senderId) === otherUserId && String(msg.receiverId) === userId),
        );

        const latestMessage = conversationMessages[0];
        const unreadCount = conversationMessages.filter(
          (msg) => String(msg.receiverId) === userId && !msg.isRead,
        ).length;

        const profile = profileMap.get(otherUserId);
        this.logger.debug(
          `[getConversations] Conversation with ${otherUserId}: profile found=${!!profile}`,
        );

        return {
          userId: otherUserId,
          user: profile || null,
          latestMessage: latestMessage
            ? {
                _id: latestMessage._id,
                content: latestMessage.content,
                senderId: String(latestMessage.senderId),
                receiverId: String(latestMessage.receiverId),
                hasFile: latestMessage.hasFile || false,
                fileName: latestMessage.fileName,
                fileType: latestMessage.fileType,
                createdAt: latestMessage.createdAt,
              }
            : null,
          unreadCount,
        };
      });

      // Sort by latest message time
      conversations.sort((a, b) => {
        if (!a.latestMessage || !a.latestMessage.createdAt) return 1;
        if (!b.latestMessage || !b.latestMessage.createdAt) return -1;
        return (
          new Date(b.latestMessage.createdAt).getTime() -
          new Date(a.latestMessage.createdAt).getTime()
        );
      });

      this.logger.log(
        `[getConversations] Found ${conversations.length} conversations for userId: ${userId}`,
      );
      return conversations;
    } catch (error) {
      this.logger.error(`[getConversations] Error:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch conversations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
