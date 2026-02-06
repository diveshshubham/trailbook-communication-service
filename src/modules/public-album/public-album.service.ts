import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Album, AlbumDocument } from '../../models/albums.schema';
import {
  AlbumInvitation,
  AlbumInvitationDocument,
  InvitationStatus,
  InvitationPermission,
} from '../../models/album-invitation.schema';
import {
  AlbumActivity,
  AlbumActivityDocument,
  ActivityType,
} from '../../models/album-activity.schema';
import { User, UserDocument } from '../../models/user.schema';
import { UserProfile, UserProfileDocument } from '../../models/user-profile.schema';
import { ConnectionRequestService } from '../communication/connection-request.service';

@Injectable()
export class PublicAlbumService {
  private readonly logger = new Logger(PublicAlbumService.name);

  constructor(
    @InjectModel(Album.name)
    private albumModel: Model<AlbumDocument>,
    @InjectModel(AlbumInvitation.name)
    private invitationModel: Model<AlbumInvitationDocument>,
    @InjectModel(AlbumActivity.name)
    private activityModel: Model<AlbumActivityDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name)
    private userProfileModel: Model<UserProfileDocument>,
    private connectionRequestService: ConnectionRequestService,
  ) {}

  /**
   * Create a public album that allows contributors
   */
  async createPublicAlbum(
    userId: string,
    title: string,
    description?: string,
    allowContributors: boolean = true,
  ) {
    try {
      this.logger.log(
        `[createPublicAlbum] Creating public album: userId=${userId}, title=${title}`,
      );

      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);

      const album = await this.albumModel.create({
        title,
        description,
        userId: userIdObjectId,
        createdBy: userIdObjectId,
        isPublic: true,
        isPublicRequested: true,
        allowContributors,
        contributorIds: [userIdObjectId], // Creator is automatically a contributor
        contributorCount: 1,
      });

      // Log activity
      await this.logActivity(
        String(album._id),
        userId,
        ActivityType.ALBUM_UPDATED,
        undefined,
        undefined,
        'Public album created',
      );

      this.logger.log(`[createPublicAlbum] Album created: ${album._id}`);
      return {
        albumId: album._id,
        message: 'Public album created successfully',
      };
    } catch (error) {
      this.logger.error(`[createPublicAlbum] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create public album: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Invite a user to contribute to a public album
   * Can invite by userId, email, or phone
   */
  async inviteUser(
    inviterId: string,
    albumId: string,
    userId?: string,
    email?: string,
    phone?: string,
    permission: InvitationPermission = InvitationPermission.CONTRIBUTOR,
    autoConnect: boolean = true,
  ) {
    try {
      this.logger.log(
        `[inviteUser] Inviting user: inviterId=${inviterId}, albumId=${albumId}`,
      );

      if (!Types.ObjectId.isValid(inviterId) || !Types.ObjectId.isValid(albumId)) {
        throw new BadRequestException('Invalid userId or albumId');
      }

      // Validate that at least one identifier is provided
      if (!userId && !email && !phone) {
        throw new BadRequestException(
          'Must provide userId, email, or phone',
        );
      }

      const inviterObjectId = new Types.ObjectId(inviterId);
      const albumObjectId = new Types.ObjectId(albumId);

      // Check if album exists and user has permission
      const album = await this.albumModel.findById(albumObjectId);
      if (!album) {
        throw new NotFoundException('Album not found');
      }

      if (!album.isPublic) {
        throw new BadRequestException(
          'Album is not public or does not allow contributors',
        );
      }

      // Check if inviter is the creator or has admin permission
      const isCreator = String(album.createdBy || album.userId) === inviterId;
      const inviterInvitation = await this.invitationModel.findOne({
        albumId: albumObjectId,
        inviteeUserId: inviterObjectId,
        status: InvitationStatus.ACCEPTED,
        permission: InvitationPermission.ADMIN,
      });

      if (!isCreator && !inviterInvitation) {
        throw new ForbiddenException(
          'Only album creator or admins can invite users',
        );
      }

      // Check if user exists on platform
      let inviteeUserId: Types.ObjectId | undefined;
      if (userId) {
        if (!Types.ObjectId.isValid(userId)) {
          throw new BadRequestException('Invalid userId');
        }
        inviteeUserId = new Types.ObjectId(userId);

        // Check if user exists
        const user = await this.userModel.findById(inviteeUserId);
        if (!user) {
          throw new NotFoundException('User not found');
        }

        // Check if user is already a contributor
        if (album.contributorIds.some((id) => String(id) === userId)) {
          throw new BadRequestException('User is already a contributor');
        }
      } else {
        // Check if email/phone belongs to an existing user
        const existingUser = await this.userModel.findOne({
          $or: [{ email }, { phone }],
        });

        if (existingUser) {
          inviteeUserId = existingUser._id;
          const existingUserIdStr = String(existingUser._id);

          // Check if user is already a contributor
          if (album.contributorIds.some((id) => String(id) === existingUserIdStr)) {
            throw new BadRequestException('User is already a contributor');
          }
        }
      }

      // Check for existing pending invitation
      const existingInvitation = await this.invitationModel.findOne({
        albumId: albumObjectId,
        $or: [
          inviteeUserId ? { inviteeUserId } : {},
          email ? { inviteeEmail: email } : {},
          phone ? { inviteePhone: phone } : {},
        ],
        status: InvitationStatus.PENDING,
      });

      if (existingInvitation) {
        throw new BadRequestException('Invitation already sent');
      }

      // Create invitation
      const invitation = await this.invitationModel.create({
        albumId: albumObjectId,
        inviterId: inviterObjectId,
        inviteeUserId,
        inviteeEmail: email,
        inviteePhone: phone,
        status: InvitationStatus.PENDING,
        permission,
        autoConnect,
      });

      this.logger.log(`[inviteUser] Invitation created: ${invitation._id}`);

      // Log activity
      await this.logActivity(
        albumId,
        inviterId,
        ActivityType.INVITATION_SENT,
        undefined,
        inviteeUserId ? new Types.ObjectId(inviteeUserId) : undefined,
        `Invited ${email || phone || 'user'} to contribute`,
      );

      // If user exists and auto-connect is enabled, create connection request
      if (inviteeUserId && autoConnect) {
        try {
          await this.connectionRequestService.sendRequest(
            inviterId,
            String(inviteeUserId),
          );
        } catch (error) {
          this.logger.warn(
            `[inviteUser] Failed to auto-connect users: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          // Don't fail the invitation if connection fails
        }
      }

      return {
        invitationId: invitation._id,
        message: 'Invitation sent successfully',
      };
    } catch (error) {
      this.logger.error(`[inviteUser] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to invite user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Accept an album invitation
   */
  async acceptInvitation(userId: string, invitationId: string) {
    try {
      this.logger.log(
        `[acceptInvitation] Accepting invitation: userId=${userId}, invitationId=${invitationId}`,
      );

      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(invitationId)) {
        throw new BadRequestException('Invalid userId or invitationId');
      }

      const userIdObjectId = new Types.ObjectId(userId);
      const invitationIdObjectId = new Types.ObjectId(invitationId);

      const invitation = await this.invitationModel.findById(invitationIdObjectId);
      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      // Verify invitation is for this user
      const invitationForUser =
        (invitation.inviteeUserId && String(invitation.inviteeUserId) === userId) ||
        (invitation.inviteeEmail &&
          (await this.userModel.findOne({ email: invitation.inviteeEmail }))?._id.toString() === userId) ||
        (invitation.inviteePhone &&
          (await this.userModel.findOne({ phone: invitation.inviteePhone }))?._id.toString() === userId);

      if (!invitationForUser) {
        throw new ForbiddenException('This invitation is not for you');
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException(`Invitation is already ${invitation.status}`);
      }

      // Update invitation
      invitation.status = InvitationStatus.ACCEPTED;
      invitation.inviteeUserId = userIdObjectId; // Ensure userId is set
      invitation.acceptedAt = new Date();
      await invitation.save();

      // Add user to album contributors
      const album = await this.albumModel.findById(invitation.albumId);
      if (!album) {
        throw new NotFoundException('Album not found');
      }

      if (!album.contributorIds.some((id) => String(id) === userId)) {
        album.contributorIds.push(userIdObjectId);
        album.contributorCount = album.contributorIds.length;
        await album.save();
      }

      // Log activity
      await this.logActivity(
        String(invitation.albumId),
        userId,
        ActivityType.CONTRIBUTOR_ADDED,
        undefined,
        userIdObjectId,
        'Joined album as contributor',
      );

      // Auto-connect if enabled
      if (invitation.autoConnect) {
        try {
          await this.connectionRequestService.sendRequest(
            String(invitation.inviterId),
            userId,
          );
        } catch (error) {
          this.logger.warn(
            `[acceptInvitation] Failed to auto-connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      this.logger.log(`[acceptInvitation] Invitation accepted: ${invitation._id}`);
      return {
        invitationId: invitation._id,
        message: 'Invitation accepted successfully',
      };
    } catch (error) {
      this.logger.error(`[acceptInvitation] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to accept invitation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Reject an album invitation
   */
  async rejectInvitation(userId: string, invitationId: string) {
    try {
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(invitationId)) {
        throw new BadRequestException('Invalid userId or invitationId');
      }

      const invitation = await this.invitationModel.findById(invitationId);
      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException(`Invitation is already ${invitation.status}`);
      }

      invitation.status = InvitationStatus.REJECTED;
      invitation.rejectedAt = new Date();
      await invitation.save();

      return {
        invitationId: invitation._id,
        message: 'Invitation rejected',
      };
    } catch (error) {
      this.logger.error(`[rejectInvitation] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to reject invitation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all invitations for a user (pending, accepted, rejected)
   */
  async getMyInvitations(userId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);

      // Get invitations by userId, email, or phone
      const user = await this.userModel.findById(userIdObjectId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const invitations = await this.invitationModel
        .find({
          $or: [
            { inviteeUserId: userIdObjectId },
            { inviteeEmail: user.email },
            { inviteePhone: user.phone },
          ],
        })
        .populate('albumId', 'title coverImage')
        .populate('inviterId', 'email phone')
        .sort({ createdAt: -1 })
        .lean();

      // Get unique inviter IDs from populated invitations
      const inviterIds = new Set<string>();
      invitations.forEach((inv) => {
        if (inv.inviterId) {
          const inviterIdStr = String(inv.inviterId._id || inv.inviterId);
          if (Types.ObjectId.isValid(inviterIdStr)) {
            inviterIds.add(inviterIdStr);
          }
        }
      });

      // Get user profiles for inviters
      const inviterObjectIds = Array.from(inviterIds).map((id) => new Types.ObjectId(id));
      const inviterProfiles = await this.userProfileModel
        .find({
          $or: [
            { userId: { $in: inviterObjectIds } },
            { userId: { $in: Array.from(inviterIds) } }, // Handle string format
          ],
        })
        .select('userId fullName profilePicture')
        .lean();

      // Create a map of userId to profile
      const profileMap = new Map();
      inviterProfiles.forEach((profile) => {
        profileMap.set(String(profile.userId), {
          fullName: profile.fullName,
          profilePicture: profile.profilePicture,
        });
      });

      // Map invitations with inviter profile info
      return invitations.map((inv) => {
        // Handle populated inviterId (can be ObjectId or populated User object)
        const inviterData = inv.inviterId as any;
        const inviterId = inviterData ? String(inviterData._id || inviterData) : null;
        const inviterProfile = inviterId ? profileMap.get(inviterId) : null;

        return {
          _id: inv._id,
          album: inv.albumId,
          inviter: {
            _id: inviterId,
            email: inviterData?.email || null,
            phone: inviterData?.phone || null,
            fullName: inviterProfile?.fullName || null,
            profilePicture: inviterProfile?.profilePicture || null,
          },
          status: inv.status,
          permission: inv.permission,
          createdAt: inv.createdAt,
          acceptedAt: inv.acceptedAt,
        };
      });
    } catch (error) {
      this.logger.error(`[getMyInvitations] Error:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch invitations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all contributors for an album
   */
  async getAlbumContributors(albumId: string, userId: string) {
    try {
      if (!Types.ObjectId.isValid(albumId) || !Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid albumId or userId');
      }

      const album = await this.albumModel.findById(albumId);
      if (!album) {
        throw new NotFoundException('Album not found');
      }

      // Check if user has access to view contributors
      const hasAccess =
        String(album.userId) === userId ||
        album.contributorIds.some((id) => String(id) === userId);

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this album');
      }

      // Get user profiles for contributors
      const contributorProfiles = await this.userProfileModel
        .find({
          userId: { $in: album.contributorIds },
        })
        .select('userId fullName bio profilePicture location')
        .lean();

      return contributorProfiles.map((profile) => ({
        userId: String(profile.userId),
        fullName: profile.fullName,
        bio: profile.bio,
        profilePicture: profile.profilePicture,
        location: profile.location,
      }));
    } catch (error) {
      this.logger.error(`[getAlbumContributors] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch contributors: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if user can add media to album
   */
  async canUserContribute(userId: string, albumId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(albumId)) {
        return false;
      }

      const album = await this.albumModel.findById(albumId);
      if (!album || !album.isPublic || !album.allowContributors) {
        return false;
      }

      // Check if user is a contributor
      return album.contributorIds.some((id) => String(id) === userId);
    } catch (error) {
      this.logger.error(`[canUserContribute] Error:`, error);
      return false;
    }
  }

  /**
   * Remove a contributor from an album (only creator/admin can do this)
   */
  async removeContributor(
    requesterId: string,
    albumId: string,
    contributorId: string,
  ) {
    try {
      if (!Types.ObjectId.isValid(requesterId) || !Types.ObjectId.isValid(albumId) || !Types.ObjectId.isValid(contributorId)) {
        throw new BadRequestException('Invalid userId or albumId');
      }

      const album = await this.albumModel.findById(albumId);
      if (!album) {
        throw new NotFoundException('Album not found');
      }

      // Check if requester is creator or admin
      const isCreator = String(album.createdBy || album.userId) === requesterId;
      const isAdmin = await this.invitationModel.findOne({
        albumId,
        inviteeUserId: new Types.ObjectId(requesterId),
        status: InvitationStatus.ACCEPTED,
        permission: InvitationPermission.ADMIN,
      });

      if (!isCreator && !isAdmin) {
        throw new ForbiddenException('Only creator or admins can remove contributors');
      }

      // Cannot remove creator
      if (String(album.createdBy || album.userId) === contributorId) {
        throw new BadRequestException('Cannot remove album creator');
      }

      // Remove contributor
      album.contributorIds = album.contributorIds.filter(
        (id) => String(id) !== contributorId,
      );
      album.contributorCount = album.contributorIds.length;
      await album.save();

      // Log activity
      await this.logActivity(
        albumId,
        requesterId,
        ActivityType.CONTRIBUTOR_REMOVED,
        undefined,
        new Types.ObjectId(contributorId),
        'Removed contributor from album',
      );

      return {
        message: 'Contributor removed successfully',
      };
    } catch (error) {
      this.logger.error(`[removeContributor] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to remove contributor: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get activity feed for an album
   */
  async getAlbumActivity(albumId: string, userId: string, limit: number = 50) {
    try {
      if (!Types.ObjectId.isValid(albumId) || !Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid albumId or userId');
      }

      const album = await this.albumModel.findById(albumId);
      if (!album) {
        throw new NotFoundException('Album not found');
      }

      // Check if user has access
      const hasAccess =
        String(album.userId) === userId ||
        String(album.createdBy || album.userId) === userId ||
        album.contributorIds?.some((id) => String(id) === userId);

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this album');
      }

      const activities = await this.activityModel
        .find({ albumId: new Types.ObjectId(albumId) })
        .populate('userId', 'email phone')
        .populate('targetUserId', 'email phone')
        .populate('mediaId', 'key title')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return activities.map((activity) => ({
        _id: activity._id,
        activityType: activity.activityType,
        user: activity.userId,
        targetUser: activity.targetUserId,
        media: activity.mediaId,
        description: activity.description,
        metadata: activity.metadata,
        createdAt: activity.createdAt,
      }));
    } catch (error) {
      this.logger.error(`[getAlbumActivity] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch activity: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Auto-accept pending invitations when user signs up
   * Call this after user registration/login
   */
  async autoAcceptInvitationsForNewUser(userId: string, email?: string, phone?: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return { accepted: 0, message: 'Invalid userId' };
      }

      const userIdObjectId = new Types.ObjectId(userId);

      // Find pending invitations for this user's email or phone
      const pendingInvitations = await this.invitationModel.find({
        status: InvitationStatus.PENDING,
        $or: [
          { inviteeEmail: email },
          { inviteePhone: phone },
        ],
      });

      let acceptedCount = 0;

      for (const invitation of pendingInvitations) {
        try {
          // Update invitation
          invitation.status = InvitationStatus.ACCEPTED;
          invitation.inviteeUserId = userIdObjectId;
          invitation.acceptedAt = new Date();
          await invitation.save();

          // Add user to album contributors
          const album = await this.albumModel.findById(invitation.albumId);
          if (album && !album.contributorIds.some((id) => String(id) === userId)) {
            album.contributorIds.push(userIdObjectId);
            album.contributorCount = album.contributorIds.length;
            await album.save();
          }

          // Log activity
          await this.logActivity(
            String(invitation.albumId),
            userId,
            ActivityType.INVITATION_ACCEPTED,
            undefined,
            userIdObjectId,
            'Auto-accepted invitation after signup',
          );

          // Auto-connect if enabled
          if (invitation.autoConnect) {
            try {
              await this.connectionRequestService.sendRequest(
                String(invitation.inviterId),
                userId,
              );
            } catch (error) {
              this.logger.warn(
                `[autoAcceptInvitationsForNewUser] Failed to auto-connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
              );
            }
          }

          acceptedCount++;
        } catch (error) {
          this.logger.error(
            `[autoAcceptInvitationsForNewUser] Failed to accept invitation ${invitation._id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `[autoAcceptInvitationsForNewUser] Auto-accepted ${acceptedCount} invitations for user ${userId}`,
      );

      return {
        accepted: acceptedCount,
        message: `Auto-accepted ${acceptedCount} pending invitations`,
      };
    } catch (error) {
      this.logger.error(`[autoAcceptInvitationsForNewUser] Error:`, error);
      return { accepted: 0, message: 'Failed to auto-accept invitations' };
    }
  }

  /**
   * Log activity for an album
   */
  private async logActivity(
    albumId: string,
    userId: string,
    activityType: ActivityType,
    mediaId?: Types.ObjectId,
    targetUserId?: Types.ObjectId,
    description?: string,
    metadata?: Record<string, any>,
  ) {
    try {
      await this.activityModel.create({
        albumId: new Types.ObjectId(albumId),
        userId: new Types.ObjectId(userId),
        activityType,
        mediaId,
        targetUserId,
        description,
        metadata,
      });
    } catch (error) {
      this.logger.warn(`[logActivity] Failed to log activity:`, error);
      // Don't throw - activity logging is non-critical
    }
  }

  /**
   * Get album analytics (contributor stats, activity stats, etc.)
   */
  async getAlbumAnalytics(albumId: string, userId: string) {
    try {
      if (!Types.ObjectId.isValid(albumId) || !Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid albumId or userId');
      }

      const album = await this.albumModel.findById(albumId);
      if (!album) {
        throw new NotFoundException('Album not found');
      }

      // Only creator or admins can view analytics
      const isCreator = String(album.createdBy || album.userId) === userId;
      const isAdmin = await this.invitationModel.findOne({
        albumId,
        inviteeUserId: new Types.ObjectId(userId),
        status: InvitationStatus.ACCEPTED,
        permission: InvitationPermission.ADMIN,
      });

      if (!isCreator && !isAdmin) {
        throw new ForbiddenException('Only creator or admins can view analytics');
      }

      // Get activity counts by type
      const activityStats = await this.activityModel.aggregate([
        { $match: { albumId: new Types.ObjectId(albumId) } },
        {
          $group: {
            _id: '$activityType',
            count: { $sum: 1 },
          },
        },
      ]);

      // Get top contributors
      const topContributors = await this.activityModel.aggregate([
        {
          $match: {
            albumId: new Types.ObjectId(albumId),
            activityType: ActivityType.MEDIA_ADDED,
          },
        },
        {
          $group: {
            _id: '$userId',
            mediaCount: { $sum: 1 },
          },
        },
        { $sort: { mediaCount: -1 } },
        { $limit: 10 },
      ]);

      return {
        albumId,
        contributorCount: album.contributorCount,
        photoCount: album.photoCount,
        activityStats: activityStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        topContributors: topContributors.length,
      };
    } catch (error) {
      this.logger.error(`[getAlbumAnalytics] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
