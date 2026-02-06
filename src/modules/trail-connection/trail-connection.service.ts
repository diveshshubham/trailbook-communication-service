import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TrailConnection,
  TrailConnectionDocument,
} from '../../models/trail-connection.schema';
import { AlbumFavorite, AlbumFavoriteDocument } from '../../models/album-favorite.schema';
import { Album, AlbumDocument } from '../../models/albums.schema';
import { MediaReflection, MediaReflectionDocument } from '../../models/media-reflection.schema';
import { ReflectionService } from '../reflection/reflection.service';
import { UserProfile, UserProfileDocument } from '../../models/user-profile.schema';
import { Media, MediaDocument } from '../../models/media.schema';

@Injectable()
export class TrailConnectionService {
  private readonly logger = new Logger(TrailConnectionService.name);

  constructor(
    @InjectModel(TrailConnection.name)
    private connectionModel: Model<TrailConnectionDocument>,
    @InjectModel(AlbumFavorite.name)
    private favoriteModel: Model<AlbumFavoriteDocument>,
    @InjectModel(Album.name)
    private albumModel: Model<AlbumDocument>,
    @InjectModel(UserProfile.name)
    private userProfileModel: Model<UserProfileDocument>,
    @InjectModel(MediaReflection.name)
    private mediaReflectionModel: Model<MediaReflectionDocument>,
    @InjectModel(Media.name)
    private mediaModel: Model<MediaDocument>,
    private reflectionService: ReflectionService,
  ) {}

  /**
   * Normalize user IDs to ensure consistent ordering (userA < userB)
   */
  private normalizeUserIds(userId1: string, userId2: string): [Types.ObjectId, Types.ObjectId] {
    const id1 = new Types.ObjectId(userId1);
    const id2 = new Types.ObjectId(userId2);
    const id1Str = String(id1);
    const id2Str = String(id2);
    
    if (id1Str < id2Str) {
      return [id1, id2];
    }
    return [id2, id1];
  }

  /**
   * Check if two users are eligible for connection
   * Eligibility requires:
   * 1. Mutual album favorites (both directions)
   * 2. At least one non-anonymous reflection
   */
  async checkConnectionEligibility(
    userId1: string,
    userId2: string,
  ): Promise<{
    eligible: boolean;
    mutualAlbums: any[];
    reflectionCount: number;
    reasons: string[];
  }> {
    try {
      this.logger.log(
        `[checkConnectionEligibility] Checking eligibility: userId1=${userId1}, userId2=${userId2}`,
      );

      if (!Types.ObjectId.isValid(userId1) || !Types.ObjectId.isValid(userId2)) {
        throw new BadRequestException('Invalid userId');
      }

      if (userId1 === userId2) {
        return {
          eligible: false,
          mutualAlbums: [],
          reflectionCount: 0,
          reasons: ['Cannot connect with yourself'],
        };
      }

      const userId1ObjectId = new Types.ObjectId(userId1);
      const userId2ObjectId = new Types.ObjectId(userId2);

      // 1. Check mutual album favorites
      // Get albums favorited by user1
      const user1Favorites = await this.favoriteModel
        .find({ userId: userId1ObjectId })
        .select('albumId')
        .lean();

      const user1FavoriteAlbumIds = user1Favorites.map((f) => f.albumId);

      if (user1FavoriteAlbumIds.length === 0) {
        return {
          eligible: false,
          mutualAlbums: [],
          reflectionCount: 0,
          reasons: ['No mutual album favorites'],
        };
      }

      // Get albums favorited by user2 that are also favorited by user1
      const user2Favorites = await this.favoriteModel
        .find({
          userId: userId2ObjectId,
          albumId: { $in: user1FavoriteAlbumIds },
        })
        .select('albumId')
        .lean();

      const mutualFavoriteAlbumIds = user2Favorites.map((f) => f.albumId);

      if (mutualFavoriteAlbumIds.length === 0) {
        return {
          eligible: false,
          mutualAlbums: [],
          reflectionCount: 0,
          reasons: ['No mutual album favorites'],
        };
      }

      // Get album details
      const mutualAlbums = await this.albumModel
        .find({
          _id: { $in: mutualFavoriteAlbumIds },
          isDeleted: { $ne: true },
        })
        .select('_id title coverImage userId')
        .lean();

      // Check if albums are owned by both users (mutual favorites)
      const user1OwnedAlbums = mutualAlbums.filter(
        (a) => String(a.userId) === userId1,
      );
      const user2OwnedAlbums = mutualAlbums.filter(
        (a) => String(a.userId) === userId2,
      );

      // Both users must have favorited at least one album owned by the other
      if (user1OwnedAlbums.length === 0 || user2OwnedAlbums.length === 0) {
        return {
          eligible: false,
          mutualAlbums: mutualAlbums.map((a) => ({
            _id: a._id,
            title: a.title,
            coverImage: a.coverImage,
          })),
          reflectionCount: 0,
          reasons: ['No mutual album favorites (both directions required)'],
        };
      }

      // 2. Check for bidirectional reflections using MediaReflection schema
      // Example: User1 has "abc" albums, User2 has "xyz" albums
      // - User1 has reflected on ANY media in User2's "xyz" albums
      this.logger.log(
        `[checkConnectionEligibility] Checking media reflections: User1=${userId1} on User2=${userId2}'s media`,
      );
      const user1ReflectionsOnUser2 = await this.getMediaReflectionsByUser(
        userId1,
        userId2,
      );

      // - User2 has reflected on ANY media in User1's "abc" albums
      this.logger.log(
        `[checkConnectionEligibility] Checking media reflections: User2=${userId2} on User1=${userId1}'s media`,
      );
      const user2ReflectionsOnUser1 = await this.getMediaReflectionsByUser(
        userId2,
        userId1,
      );

      // Total count: reflections in both directions (across all albums)
      const totalBidirectionalReflections = user1ReflectionsOnUser2.length + user2ReflectionsOnUser1.length;

      this.logger.log(
        `[checkConnectionEligibility] Media reflection counts: User1→User2=${user1ReflectionsOnUser2.length}, User2→User1=${user2ReflectionsOnUser1.length}, Total=${totalBidirectionalReflections}`,
      );

      // Both users must have reflected on each other's media
      if (user1ReflectionsOnUser2.length === 0 || user2ReflectionsOnUser1.length === 0) {
        return {
          eligible: false,
          mutualAlbums: mutualAlbums.map((a) => ({
            _id: a._id,
            title: a.title,
            coverImage: a.coverImage,
          })),
          reflectionCount: totalBidirectionalReflections,
          reasons: ['No bidirectional reflections found (both users must reflect on each other\'s media)'],
        };
      }

      // All conditions met!
      this.logger.log(
        `[checkConnectionEligibility] Users are eligible: userId1=${userId1}, userId2=${userId2}`,
      );

      return {
        eligible: true,
        mutualAlbums: mutualAlbums.map((a) => ({
          _id: a._id,
          title: a.title,
          coverImage: a.coverImage,
        })),
        reflectionCount: totalBidirectionalReflections,
        reasons: [],
      };
    } catch (error) {
      this.logger.error(
        `[checkConnectionEligibility] Error checking eligibility:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to check connection eligibility: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create a connection (add to "Walked Together")
   */
  async createConnection(userId1: string, userId2: string) {
    try {
      this.logger.log(
        `[createConnection] Creating connection: userId1=${userId1}, userId2=${userId2}`,
      );

      if (!Types.ObjectId.isValid(userId1) || !Types.ObjectId.isValid(userId2)) {
        throw new BadRequestException('Invalid userId');
      }

      if (userId1 === userId2) {
        throw new BadRequestException('Cannot connect with yourself');
      }

      // Check eligibility first
      const eligibility = await this.checkConnectionEligibility(userId1, userId2);
      if (!eligibility.eligible) {
        throw new BadRequestException(
          `Connection not eligible: ${eligibility.reasons.join(', ')}`,
        );
      }

      // Normalize user IDs
      const [userA, userB] = this.normalizeUserIds(userId1, userId2);

      // Check if connection already exists
      const existing = await this.connectionModel
        .findOne({
          userA,
          userB,
        })
        .lean();

      if (existing) {
        if (existing.isActive) {
          this.logger.log(
            `[createConnection] Connection already exists and is active`,
          );
          return { connected: true, message: 'Already connected' };
        } else {
          // Reactivate connection
          await this.connectionModel.updateOne(
            { _id: existing._id },
            {
              isActive: true,
              mutualAlbumIds: eligibility.mutualAlbums.map((a) => a._id),
              reflectionCount: eligibility.reflectionCount,
            },
          );
          this.logger.log(`[createConnection] Connection reactivated`);
          return { connected: true, message: 'Connection reactivated' };
        }
      }

      // Create new connection
      const connection = await this.connectionModel.create({
        userA,
        userB,
        mutualAlbumIds: eligibility.mutualAlbums.map((a) => a._id),
        reflectionCount: eligibility.reflectionCount,
        isActive: true,
      });

      this.logger.log(
        `[createConnection] Connection created successfully: ${connection._id}`,
      );
      return { connected: true, message: 'Connection created', connectionId: connection._id };
    } catch (error) {
      this.logger.error(`[createConnection] Error creating connection:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all connections for a user (Walked Together list)
   */
  async getConnections(userId: string) {
    try {
      this.logger.log(`[getConnections] Fetching connections for userId: ${userId}`);

      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);

      // Get connections where user is either userA or userB
      const connections = await this.connectionModel
        .find({
          $or: [{ userA: userIdObjectId }, { userB: userIdObjectId }],
          isActive: true,
        })
        .sort({ createdAt: -1 })
        .lean();

      // Get user IDs of connected users
      const connectedUserIds = connections.map((conn) => {
        const userAStr = String(conn.userA);
        const userBStr = String(conn.userB);
        const otherUserId =
          userAStr === userId ? conn.userB : conn.userA;
        return otherUserId;
      });

      this.logger.debug(
        `[getConnections] Found ${connectedUserIds.length} connected user IDs: ${connectedUserIds.map((id) => String(id)).join(', ')}`,
      );

      // Get user profiles (only if we have connected user IDs)
      // Handle both ObjectId and string formats for backward compatibility
      let userProfiles: any[] = [];
      if (connectedUserIds.length > 0) {
        // Convert all IDs to both ObjectId and string formats for query
        const userIdObjectIds = connectedUserIds.map((id) => new Types.ObjectId(String(id)));
        const userIdStrings = connectedUserIds.map((id) => String(id));

        userProfiles = await this.userProfileModel
          .find({
            $or: [
              { userId: { $in: userIdObjectIds } },
              { userId: { $in: userIdStrings } }, // Handle string format (backward compatibility)
            ],
          })
          .select('userId fullName bio profilePicture location')
          .lean();
      }

      this.logger.debug(
        `[getConnections] Found ${userProfiles.length} user profiles`,
      );

      const profileMap = new Map();
      userProfiles.forEach((profile) => {
        const profileUserIdStr = String(profile.userId);
        profileMap.set(profileUserIdStr, {
          fullName: profile.fullName,
          bio: profile.bio,
          profilePicture: profile.profilePicture,
          location: profile.location,
        });
        this.logger.debug(
          `[getConnections] Added profile to map for userId: ${profileUserIdStr}`,
        );
      });

      // Get album details for mutual albums
      const allAlbumIds = new Set<Types.ObjectId>();
      connections.forEach((conn) => {
        conn.mutualAlbumIds.forEach((id) => allAlbumIds.add(id));
      });

      const albums = await this.albumModel
        .find({
          _id: { $in: Array.from(allAlbumIds) },
        })
        .select('_id title coverImage')
        .lean();

      const albumMap = new Map();
      albums.forEach((album) => {
        albumMap.set(String(album._id), {
          _id: album._id,
          title: album.title,
          coverImage: album.coverImage,
        });
      });

      // Build response
      const result = connections.map((conn) => {
        const userAStr = String(conn.userA);
        const userBStr = String(conn.userB);
        const otherUserId = userAStr === userId ? conn.userB : conn.userA;
        const otherUserIdStr = String(otherUserId);
        const profile = profileMap.get(otherUserIdStr) || null;

        this.logger.debug(
          `[getConnections] Connection ${conn._id}: otherUserId=${otherUserIdStr}, profile found=${!!profile}`,
        );

        return {
          _id: conn._id,
          userId: otherUserIdStr,
          user: profile,
          mutualAlbums: conn.mutualAlbumIds
            .map((id) => albumMap.get(String(id)))
            .filter((a) => a !== undefined),
          reflectionCount: conn.reflectionCount,
          connectedAt: conn.createdAt,
        };
      });

      this.logger.log(
        `[getConnections] Found ${result.length} connections for userId: ${userId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[getConnections] Error fetching connections for userId ${userId}:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch connections: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get connection details between two users
   */
  async getConnectionDetails(userId1: string, userId2: string) {
    try {
      if (!Types.ObjectId.isValid(userId1) || !Types.ObjectId.isValid(userId2)) {
        throw new BadRequestException('Invalid userId');
      }

      const [userA, userB] = this.normalizeUserIds(userId1, userId2);

      const connection = await this.connectionModel
        .findOne({
          userA,
          userB,
          isActive: true,
        })
        .lean();

      if (!connection) {
        throw new NotFoundException('Connection not found');
      }

      // Get eligibility info
      const eligibility = await this.checkConnectionEligibility(userId1, userId2);

      return {
        connection: {
          _id: connection._id,
          mutualAlbums: eligibility.mutualAlbums,
          reflectionCount: eligibility.reflectionCount,
          connectedAt: connection.createdAt,
        },
        eligible: eligibility.eligible,
      };
    } catch (error) {
      this.logger.error(`[getConnectionDetails] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to get connection details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Remove connection (soft delete - set isActive to false)
   */
  async removeConnection(userId1: string, userId2: string) {
    try {
      this.logger.log(
        `[removeConnection] Removing connection: userId1=${userId1}, userId2=${userId2}`,
      );

      if (!Types.ObjectId.isValid(userId1) || !Types.ObjectId.isValid(userId2)) {
        throw new BadRequestException('Invalid userId');
      }

      const [userA, userB] = this.normalizeUserIds(userId1, userId2);

      const result = await this.connectionModel.updateOne(
        {
          userA,
          userB,
        },
        {
          isActive: false,
        },
      );

      if (result.matchedCount === 0) {
        throw new NotFoundException('Connection not found');
      }

      this.logger.log(`[removeConnection] Connection removed successfully`);
      return { removed: true, message: 'Connection removed' };
    } catch (error) {
      this.logger.error(`[removeConnection] Error:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to remove connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Background job: Check and update connection eligibility
   * This can be called periodically to update mutual albums and reflection counts
   */
  async updateConnectionEligibility(userId1: string, userId2: string) {
    try {
      const [userA, userB] = this.normalizeUserIds(userId1, userId2);

      const connection = await this.connectionModel
        .findOne({
          userA,
          userB,
          isActive: true,
        })
        .lean();

      if (!connection) {
        return { updated: false, message: 'No active connection found' };
      }

      const eligibility = await this.checkConnectionEligibility(userId1, userId2);

      // Update connection with latest data
      await this.connectionModel.updateOne(
        { _id: connection._id },
        {
          mutualAlbumIds: eligibility.mutualAlbums.map((a) => a._id),
          reflectionCount: eligibility.reflectionCount,
        },
      );

      // If no longer eligible, deactivate connection
      if (!eligibility.eligible) {
        await this.connectionModel.updateOne(
          { _id: connection._id },
          { isActive: false },
        );
        return {
          updated: true,
          message: 'Connection deactivated (no longer eligible)',
        };
      }

      return { updated: true, message: 'Connection updated' };
    } catch (error) {
      this.logger.error(`[updateConnectionEligibility] Error:`, error);
      return { updated: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get all media reflections given by a user on another user's media
   * Checks ALL media owned by target user, regardless of which album it belongs to
   * Uses MediaReflection schema
   */
  private async getMediaReflectionsByUser(
    userId: string,
    targetUserId: string,
  ) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(targetUserId)) {
      this.logger.warn(
        `[getMediaReflectionsByUser] Invalid IDs: userId=${userId}, targetUserId=${targetUserId}`,
      );
      return [];
    }

    const userIdObjectId = new Types.ObjectId(userId);
    const targetUserIdObjectId = new Types.ObjectId(targetUserId);

    this.logger.debug(
      `[getMediaReflectionsByUser] Checking media reflections: userId=${userId} on targetUserId=${targetUserId}'s media`,
    );

    // Get all albums owned by target user (to find all their media)
    const targetAlbums = await this.albumModel
      .find({ userId: targetUserIdObjectId })
      .select('_id')
      .lean();

    const targetAlbumIds = targetAlbums.map((a) => a._id);

    this.logger.debug(
      `[getMediaReflectionsByUser] Found ${targetAlbumIds.length} albums for targetUserId=${targetUserId}`,
    );

    if (targetAlbumIds.length === 0) {
      this.logger.debug(
        `[getMediaReflectionsByUser] No albums found for targetUserId=${targetUserId}`,
      );
      return [];
    }

    // Get ALL media in target user's albums (across all albums, irrespective of album ID)
    const targetMedia = await this.mediaModel
      .find({
        albumId: { $in: targetAlbumIds },
        isDeleted: { $ne: true },
      })
      .select('_id')
      .lean();

    const targetMediaIds = targetMedia.map((m) => m._id);

    this.logger.debug(
      `[getMediaReflectionsByUser] Found ${targetMediaIds.length} media items in target user's albums`,
    );

    if (targetMediaIds.length === 0) {
      this.logger.debug(
        `[getMediaReflectionsByUser] No media found in albums for targetUserId=${targetUserId}`,
      );
      return [];
    }

    // Get media reflections by userId on ANY media owned by target user
    const reflections = await this.mediaReflectionModel
      .find({
        userId: userIdObjectId,
        mediaId: { $in: targetMediaIds },
      })
      .lean();

    this.logger.debug(
      `[getMediaReflectionsByUser] Found ${reflections.length} media reflections by userId=${userId} on targetUserId=${targetUserId}'s media`,
    );

    return reflections;
  }
}
