import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ConnectionRequest,
  ConnectionRequestDocument,
  ConnectionRequestStatus,
} from '../../models/connection-request.schema';
import { UserProfile, UserProfileDocument } from '../../models/user-profile.schema';

@Injectable()
export class ConnectionRequestService {
  private readonly logger = new Logger(ConnectionRequestService.name);

  constructor(
    @InjectModel(ConnectionRequest.name)
    private connectionRequestModel: Model<ConnectionRequestDocument>,
    @InjectModel(UserProfile.name)
    private userProfileModel: Model<UserProfileDocument>,
  ) {}

  /**
   * Send a connection request
   */
  async sendRequest(requesterId: string, recipientId: string) {
    try {
      this.logger.log(
        `[sendRequest] Sending request: requesterId=${requesterId}, recipientId=${recipientId}`,
      );

      if (!Types.ObjectId.isValid(requesterId) || !Types.ObjectId.isValid(recipientId)) {
        throw new BadRequestException('Invalid userId');
      }

      if (requesterId === recipientId) {
        throw new BadRequestException('Cannot send request to yourself');
      }

      const requesterObjectId = new Types.ObjectId(requesterId);
      const recipientObjectId = new Types.ObjectId(recipientId);

      // Check if users are already connected
      const acceptedRequest = await this.connectionRequestModel.findOne({
        $or: [
          { requesterId: requesterObjectId, recipientId: recipientObjectId },
          { requesterId: recipientObjectId, recipientId: requesterObjectId },
        ],
        status: ConnectionRequestStatus.ACCEPTED,
      });

      if (acceptedRequest) {
        throw new BadRequestException('Already connected');
      }

      // Check if there's a pending request
      const pendingRequest = await this.connectionRequestModel.findOne({
        $or: [
          { requesterId: requesterObjectId, recipientId: recipientObjectId },
          { requesterId: recipientObjectId, recipientId: requesterObjectId },
        ],
        status: ConnectionRequestStatus.PENDING,
      });

      if (pendingRequest) {
        if (String(pendingRequest.requesterId) === requesterId) {
          throw new BadRequestException('Request already sent');
        } else {
          throw new BadRequestException('You have a pending request from this user');
        }
      }

      // Create new request
      const request = await this.connectionRequestModel.create({
        requesterId: requesterObjectId,
        recipientId: recipientObjectId,
        status: ConnectionRequestStatus.PENDING,
      });

      this.logger.log(`[sendRequest] Request created: ${request._id}`);
      return { requestId: request._id, message: 'Request sent' };
    } catch (error) {
      this.logger.error(`[sendRequest] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to send request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Accept a connection request
   */
  async acceptRequest(userId: string, requestId: string) {
    try {
      this.logger.log(
        `[acceptRequest] Accepting request: userId=${userId}, requestId=${requestId}`,
      );

      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(requestId)) {
        throw new BadRequestException('Invalid userId or requestId');
      }

      const userIdObjectId = new Types.ObjectId(userId);
      const requestIdObjectId = new Types.ObjectId(requestId);

      const request = await this.connectionRequestModel.findById(requestIdObjectId);

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      if (String(request.recipientId) !== userId) {
        throw new BadRequestException('You are not the recipient of this request');
      }

      if (request.status !== ConnectionRequestStatus.PENDING) {
        throw new BadRequestException(`Request is already ${request.status}`);
      }

      request.status = ConnectionRequestStatus.ACCEPTED;
      await request.save();

      this.logger.log(`[acceptRequest] Request accepted: ${request._id}`);
      return { requestId: request._id, message: 'Request accepted' };
    } catch (error) {
      this.logger.error(`[acceptRequest] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to accept request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Reject a connection request
   */
  async rejectRequest(userId: string, requestId: string) {
    try {
      this.logger.log(
        `[rejectRequest] Rejecting request: userId=${userId}, requestId=${requestId}`,
      );

      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(requestId)) {
        throw new BadRequestException('Invalid userId or requestId');
      }

      const userIdObjectId = new Types.ObjectId(userId);
      const requestIdObjectId = new Types.ObjectId(requestId);

      const request = await this.connectionRequestModel.findById(requestIdObjectId);

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      if (String(request.recipientId) !== userId) {
        throw new BadRequestException('You are not the recipient of this request');
      }

      if (request.status !== ConnectionRequestStatus.PENDING) {
        throw new BadRequestException(`Request is already ${request.status}`);
      }

      request.status = ConnectionRequestStatus.REJECTED;
      await request.save();

      this.logger.log(`[rejectRequest] Request rejected: ${request._id}`);
      return { requestId: request._id, message: 'Request rejected' };
    } catch (error) {
      this.logger.error(`[rejectRequest] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to reject request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all connected people (accepted requests)
   */
  async getConnectedPeople(userId: string) {
    try {
      this.logger.log(`[getConnectedPeople] Fetching for userId: ${userId}`);

      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);

      const connections = await this.connectionRequestModel
        .find({
          $or: [
            { requesterId: userIdObjectId },
            { recipientId: userIdObjectId },
          ],
          status: ConnectionRequestStatus.ACCEPTED,
        })
        .sort({ updatedAt: -1 })
        .lean();

      const connectedUserIds = connections.map((conn) => {
        const requesterStr = String(conn.requesterId);
        const recipientStr = String(conn.recipientId);
        return requesterStr === userId ? conn.recipientId : conn.requesterId;
      });

      // Get user profiles - ensure ObjectIds are properly converted
      // Convert all IDs to ObjectId format for query
      const connectedUserObjectIds = connectedUserIds.map((id) => new Types.ObjectId(String(id)));
      const connectedUserStrings = connectedUserIds.map((id) => String(id));
      
      // Query with both ObjectId and string formats for compatibility
      const userProfiles = await this.userProfileModel
        .find({
          $or: [
            { userId: { $in: connectedUserObjectIds } },
            { userId: { $in: connectedUserStrings } }, // Handle string format (backward compatibility)
          ],
        })
        .select('userId fullName bio profilePicture location')
        .lean();

      this.logger.debug(
        `[getConnectedPeople] Found ${userProfiles.length} profiles out of ${connectedUserIds.length} user IDs`,
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
          `[getConnectedPeople] Added profile for userId: ${profileUserIdStr}`,
        );
      });

      const result = connections.map((conn) => {
        const requesterStr = String(conn.requesterId);
        const recipientStr = String(conn.recipientId);
        const otherUserId =
          requesterStr === userId ? conn.recipientId : conn.requesterId;
        const otherUserIdStr = String(otherUserId);

        const profile = profileMap.get(otherUserIdStr);
        this.logger.debug(
          `[getConnectedPeople] Connection ${conn._id}: otherUserId=${otherUserIdStr}, profile found=${!!profile}`,
        );

        return {
          requestId: conn._id,
          userId: otherUserIdStr,
          user: profile || null,
          connectedAt: conn.updatedAt, // When it was accepted
        };
      });

      this.logger.log(
        `[getConnectedPeople] Found ${result.length} connections for userId: ${userId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`[getConnectedPeople] Error:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch connected people: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all rejected people
   */
  async getRejectedPeople(userId: string) {
    try {
      this.logger.log(`[getRejectedPeople] Fetching for userId: ${userId}`);

      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);

      const rejectedRequests = await this.connectionRequestModel
        .find({
          $or: [
            { requesterId: userIdObjectId },
            { recipientId: userIdObjectId },
          ],
          status: ConnectionRequestStatus.REJECTED,
        })
        .sort({ updatedAt: -1 })
        .lean();

      const rejectedUserIds = rejectedRequests.map((req) => {
        const requesterStr = String(req.requesterId);
        const recipientStr = String(req.recipientId);
        return requesterStr === userId ? req.recipientId : req.requesterId;
      });

      // Get user profiles - ensure ObjectIds are properly converted
      // Convert all IDs to ObjectId format for query
      const rejectedUserObjectIds = rejectedUserIds.map((id) => new Types.ObjectId(String(id)));
      const rejectedUserStrings = rejectedUserIds.map((id) => String(id));
      
      // Query with both ObjectId and string formats for compatibility
      const userProfiles = await this.userProfileModel
        .find({
          $or: [
            { userId: { $in: rejectedUserObjectIds } },
            { userId: { $in: rejectedUserStrings } }, // Handle string format (backward compatibility)
          ],
        })
        .select('userId fullName bio profilePicture location')
        .lean();

      this.logger.debug(
        `[getRejectedPeople] Found ${userProfiles.length} profiles out of ${rejectedUserIds.length} user IDs`,
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
          `[getRejectedPeople] Added profile for userId: ${profileUserIdStr}`,
        );
      });

      const result = rejectedRequests.map((req) => {
        const requesterStr = String(req.requesterId);
        const recipientStr = String(req.recipientId);
        const otherUserId =
          requesterStr === userId ? req.recipientId : req.requesterId;
        const otherUserIdStr = String(otherUserId);

        const profile = profileMap.get(otherUserIdStr);
        this.logger.debug(
          `[getRejectedPeople] Request ${req._id}: otherUserId=${otherUserIdStr}, profile found=${!!profile}`,
        );

        return {
          requestId: req._id,
          userId: otherUserIdStr,
          user: profile || null,
          rejectedAt: req.updatedAt,
          wasRequester: String(req.requesterId) === userId,
        };
      });

      this.logger.log(
        `[getRejectedPeople] Found ${result.length} rejected requests for userId: ${userId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`[getRejectedPeople] Error:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch rejected people: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all pending requests (both sent and received)
   */
  async getPendingRequests(userId: string) {
    try {
      this.logger.log(`[getPendingRequests] Fetching for userId: ${userId}`);

      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);

      const pendingRequests = await this.connectionRequestModel
        .find({
          $or: [
            { requesterId: userIdObjectId },
            { recipientId: userIdObjectId },
          ],
          status: ConnectionRequestStatus.PENDING,
        })
        .sort({ createdAt: -1 })
        .lean();

      const otherUserIds = pendingRequests.map((req) => {
        const requesterStr = String(req.requesterId);
        const recipientStr = String(req.recipientId);
        return requesterStr === userId ? req.recipientId : req.requesterId;
      });

      // Get user profiles - ensure ObjectIds are properly converted
      // Convert all IDs to ObjectId format for query
      const otherUserObjectIds = otherUserIds.map((id) => new Types.ObjectId(String(id)));
      const otherUserStrings = otherUserIds.map((id) => String(id));
      
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
        `[getPendingRequests] Found ${userProfiles.length} profiles out of ${otherUserIds.length} user IDs`,
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
          `[getPendingRequests] Added profile for userId: ${profileUserIdStr}`,
        );
      });

      const result = pendingRequests.map((req) => {
        const requesterStr = String(req.requesterId);
        const recipientStr = String(req.recipientId);
        const otherUserId =
          requesterStr === userId ? req.recipientId : req.requesterId;
        const otherUserIdStr = String(otherUserId);

        const profile = profileMap.get(otherUserIdStr);
        this.logger.debug(
          `[getPendingRequests] Request ${req._id}: otherUserId=${otherUserIdStr}, profile found=${!!profile}`,
        );

        return {
          requestId: req._id,
          userId: otherUserIdStr,
          user: profile || null,
          requestedAt: req.createdAt,
          isReceived: String(req.recipientId) === userId, // true if received, false if sent
        };
      });

      this.logger.log(
        `[getPendingRequests] Found ${result.length} pending requests for userId: ${userId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`[getPendingRequests] Error:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch pending requests: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if two users are connected
   */
  async areConnected(userId1: string, userId2: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId1) || !Types.ObjectId.isValid(userId2)) {
      return false;
    }

    const userId1ObjectId = new Types.ObjectId(userId1);
    const userId2ObjectId = new Types.ObjectId(userId2);

    const connection = await this.connectionRequestModel.findOne({
      $or: [
        { requesterId: userId1ObjectId, recipientId: userId2ObjectId },
        { requesterId: userId2ObjectId, recipientId: userId1ObjectId },
      ],
      status: ConnectionRequestStatus.ACCEPTED,
    });

    return !!connection;
  }
}
