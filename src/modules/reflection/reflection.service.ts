import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Reflection,
  ReflectionDocument,
  ReflectionReason,
} from '../../models/reflection.schema';
import { Media, MediaDocument } from '../../models/media.schema';
import { Album, AlbumDocument } from '../../models/albums.schema';
import { UserProfile, UserProfileDocument } from '../../models/user-profile.schema';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class ReflectionService {
  private readonly logger = new Logger(ReflectionService.name);
  private readonly RATE_LIMIT_KEY_PREFIX = 'reflection:rate_limit:';
  private readonly MAX_REFLECTIONS_PER_HOUR = 50; // Spam prevention

  constructor(
    @InjectModel(Reflection.name)
    private reflectionModel: Model<ReflectionDocument>,
    @InjectModel(Media.name)
    private mediaModel: Model<MediaDocument>,
    @InjectModel(Album.name)
    private albumModel: Model<AlbumDocument>,
    @InjectModel(UserProfile.name)
    private userProfileModel: Model<UserProfileDocument>,
    private redisService: RedisService,
  ) {}

  /**
   * Add reflection to a media (photo)
   * Includes rate limiting to prevent spam
   */
  async addReflection(
    mediaId: string,
    userId: string,
    reason: ReflectionReason,
    note?: string,
    isAnonymous: boolean = false,
  ) {
    try {
      this.logger.log(
        `[addReflection] Adding reflection: mediaId=${mediaId}, userId=${userId}, reason=${reason}`,
      );

      // Validate inputs
      if (!Types.ObjectId.isValid(mediaId)) {
        throw new BadRequestException('Invalid mediaId');
      }

      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const mediaIdObjectId = new Types.ObjectId(mediaId);
      const userIdObjectId = new Types.ObjectId(userId);

      // Rate limiting: Check if user has exceeded limit
      const rateLimitKey = `${this.RATE_LIMIT_KEY_PREFIX}${userId}`;
      const currentCount = await this.redisService.incr(rateLimitKey, 3600); // 1 hour TTL
      if (currentCount > this.MAX_REFLECTIONS_PER_HOUR) {
        this.logger.warn(
          `[addReflection] Rate limit exceeded for userId: ${userId}`,
        );
        throw new BadRequestException(
          'Too many reflections. Please wait before reflecting on more content.',
        );
      }

      // Check if media exists and is accessible
      const media = await this.mediaModel
        .findOne({
          _id: mediaIdObjectId,
          isDeleted: { $ne: true },
        })
        .lean();

      if (!media) {
        throw new NotFoundException('Media not found');
      }

      // Check if album is public or owned by user
      const album = await this.albumModel.findById(media.albumId).lean();
      if (!album) {
        throw new NotFoundException('Album not found');
      }

      const isOwnMedia = String(album.userId) === String(userId);
      if (!isOwnMedia && !album.isPublic) {
        throw new ForbiddenException(
          'You can only reflect on public media or your own media',
        );
      }

      // Check if already reflected
      const existing = await this.reflectionModel
        .findOne({
          userId: userIdObjectId,
          mediaId: mediaIdObjectId,
        })
        .lean();

      if (existing) {
        // Update existing reflection
        await this.reflectionModel.updateOne(
          { _id: existing._id },
          {
            reason,
            note: note || undefined,
            isAnonymous,
          },
        );
        this.logger.log(
          `[addReflection] Reflection updated: mediaId=${mediaId}`,
        );
        return { reflected: true, message: 'Reflection updated' };
      }

      // Create new reflection
      await this.reflectionModel.create({
        userId: userIdObjectId,
        mediaId: mediaIdObjectId,
        reason,
        note: note || undefined,
        isAnonymous,
      });

      this.logger.log(
        `[addReflection] Reflection added successfully: mediaId=${mediaId}`,
      );
      return { reflected: true, message: 'Reflection added' };
    } catch (error) {
      this.logger.error(
        `[addReflection] Error adding reflection for mediaId ${mediaId}:`,
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to add reflection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Remove reflection from a media
   */
  async removeReflection(mediaId: string, userId: string) {
    try {
      this.logger.log(
        `[removeReflection] Removing reflection: mediaId=${mediaId}, userId=${userId}`,
      );

      if (!Types.ObjectId.isValid(mediaId)) {
        throw new BadRequestException('Invalid mediaId');
      }

      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const mediaIdObjectId = new Types.ObjectId(mediaId);
      const userIdObjectId = new Types.ObjectId(userId);

      const result = await this.reflectionModel.deleteOne({
        userId: userIdObjectId,
        mediaId: mediaIdObjectId,
      });

      if (result.deletedCount === 0) {
        this.logger.warn(
          `[removeReflection] Reflection not found: mediaId=${mediaId}, userId=${userId}`,
        );
        return { removed: false, message: 'Reflection not found' };
      }

      this.logger.log(
        `[removeReflection] Reflection removed successfully: mediaId=${mediaId}`,
      );
      return { removed: true, message: 'Reflection removed' };
    } catch (error) {
      this.logger.error(
        `[removeReflection] Error removing reflection for mediaId ${mediaId}:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to remove reflection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all reflections for a media
   */
  async getReflections(mediaId: string, userId?: string) {
    try {
      this.logger.log(
        `[getReflections] Fetching reflections for mediaId: ${mediaId}`,
      );

      if (!Types.ObjectId.isValid(mediaId)) {
        throw new BadRequestException('Invalid mediaId');
      }

      const mediaIdObjectId = new Types.ObjectId(mediaId);

      const reflections = await this.reflectionModel
        .find({
          mediaId: mediaIdObjectId,
        })
        .sort({ createdAt: -1 })
        .lean();

      // Filter anonymous reflections (only show to media owner)
      const media = await this.mediaModel.findById(mediaIdObjectId).lean();
      if (!media) {
        throw new NotFoundException('Media not found');
      }

      const album = await this.albumModel.findById(media.albumId).lean();
      if (!album) {
        throw new NotFoundException('Album not found');
      }

      const isOwner = userId && String(album.userId) === String(userId);

      // Get user profiles for all reflections
      const userIds = reflections.map((ref) => ref.userId);
      const userProfiles = await this.userProfileModel
        .find({
          userId: { $in: userIds },
        })
        .select('userId fullName profilePicture')
        .lean();

      const profileMap = new Map();
      userProfiles.forEach((profile) => {
        profileMap.set(String(profile.userId), {
          _id: profile.userId,
          fullName: profile.fullName,
          profilePicture: profile.profilePicture,
        });
      });

      const filteredReflections = reflections
        .filter((ref) => {
          // Show anonymous only to owner
          if (ref.isAnonymous && !isOwner) {
            return false;
          }
          return true;
        })
        .map((ref) => ({
          _id: ref._id,
          reason: ref.reason,
          note: ref.note,
          isAnonymous: ref.isAnonymous,
          createdAt: ref.createdAt,
          user: ref.isAnonymous && !isOwner
            ? null
            : profileMap.get(String(ref.userId)) || null,
        }));

      this.logger.log(
        `[getReflections] Found ${filteredReflections.length} reflections for mediaId: ${mediaId}`,
      );
      return filteredReflections;
    } catch (error) {
      this.logger.error(
        `[getReflections] Error fetching reflections for mediaId ${mediaId}:`,
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch reflections: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if user has reflected on a media
   */
  async hasReflected(mediaId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(mediaId) || !Types.ObjectId.isValid(userId)) {
      return false;
    }

    const count = await this.reflectionModel.countDocuments({
      userId: new Types.ObjectId(userId),
      mediaId: new Types.ObjectId(mediaId),
    });

    return count > 0;
  }

  /**
   * Get all reflections given by a user on another user's media
   * Checks ALL media owned by target user, regardless of which album it belongs to
   * (for connection eligibility checks)
   */
  async getReflectionsByUser(
    userId: string,
    targetUserId: string,
    includeAnonymous: boolean = false,
  ) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(targetUserId)) {
      this.logger.warn(
        `[getReflectionsByUser] Invalid IDs: userId=${userId}, targetUserId=${targetUserId}`,
      );
      return [];
    }

    const userIdObjectId = new Types.ObjectId(userId);
    const targetUserIdObjectId = new Types.ObjectId(targetUserId);

    this.logger.debug(
      `[getReflectionsByUser] Checking reflections: userId=${userId} on targetUserId=${targetUserId}'s media`,
    );

    // Get all albums owned by target user (to find all their media)
    const targetAlbums = await this.albumModel
      .find({ userId: targetUserIdObjectId })
      .select('_id')
      .lean();

    const targetAlbumIds = targetAlbums.map((a) => a._id);

    this.logger.debug(
      `[getReflectionsByUser] Found ${targetAlbumIds.length} albums for targetUserId=${targetUserId}`,
    );

    if (targetAlbumIds.length === 0) {
      this.logger.debug(
        `[getReflectionsByUser] No albums found for targetUserId=${targetUserId}`,
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
      `[getReflectionsByUser] Found ${targetMediaIds.length} media items in target user's albums`,
    );

    if (targetMediaIds.length === 0) {
      this.logger.debug(
        `[getReflectionsByUser] No media found in albums for targetUserId=${targetUserId}`,
      );
      return [];
    }

    // Get reflections by userId on ANY media owned by target user
    const query: any = {
      userId: userIdObjectId,
      mediaId: { $in: targetMediaIds },
    };

    if (!includeAnonymous) {
      query.isAnonymous = false;
    }

    this.logger.debug(
      `[getReflectionsByUser] Query: ${JSON.stringify({
        userId: String(userIdObjectId),
        mediaIdCount: targetMediaIds.length,
        isAnonymous: query.isAnonymous,
      })}`,
    );

    const reflections = await this.reflectionModel.find(query).lean();

    this.logger.debug(
      `[getReflectionsByUser] Found ${reflections.length} reflections by userId=${userId} on targetUserId=${targetUserId}'s media`,
    );

    return reflections;
  }
}
