import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { Media, MediaDocument } from '../../models/media.schema';
import { Album, AlbumDocument } from '../../models/albums.schema';
import { UpdateMediaDetailsDto } from './dto/update-media-details.dto';
import { S3_CLIENT } from '../../common/s3/s3.provider';

const DEFAULT_ALBUM_COVER = 'https://picsum.photos/seed/picsum/200/300';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectModel(Media.name)
    private mediaModel: Model<MediaDocument>,
    @InjectModel(Album.name)
    private albumModel: Model<AlbumDocument>,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
  ) {}

  /**
   * Backward-compatible filter for legacy records:
   * - Some older media documents may have `albumId` stored as a string instead of ObjectId.
   */
  private albumIdFilter(albumId: string) {
    const albumIdObjectId = new Types.ObjectId(albumId);
    return {
      $or: [
        { albumId: albumIdObjectId },
        // legacy: albumId stored as string
        { albumId: albumId as unknown as any },
      ],
    };
  }

  async assertAlbumOwnedByUser(albumId: string, userId: string) {
    try {
      this.logger.debug(`[assertAlbumOwnedByUser] Verifying ownership for albumId: ${albumId}, userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(albumId)) {
        this.logger.error(`[assertAlbumOwnedByUser] Invalid albumId: ${albumId}`);
        throw new BadRequestException('Invalid albumId');
      }

      if (!Types.ObjectId.isValid(userId)) {
        this.logger.error(`[assertAlbumOwnedByUser] Invalid userId: ${userId}`);
        throw new BadRequestException('Invalid userId');
      }

      const album = await this.albumModel.findById(albumId).select('userId isPublic allowContributors contributorIds createdBy').lean();
      if (!album) {
        this.logger.warn(`[assertAlbumOwnedByUser] Album not found: ${albumId}`);
        throw new NotFoundException('Album not found');
      }

      // Check if user is the owner
      const isOwner = String(album.userId) === String(userId) || String(album.createdBy || album.userId) === String(userId);
      
      // Check if user is a contributor (for public albums)
      const isContributor = album.isPublic && 
                           album.allowContributors && 
                           album.contributorIds?.some((id) => String(id) === String(userId));

      if (!isOwner && !isContributor) {
        this.logger.warn(`[assertAlbumOwnedByUser] Access denied: userId ${userId} does not have access to album ${albumId}`);
        throw new ForbiddenException('You do not have permission to add media to this album');
      }

      this.logger.debug(`[assertAlbumOwnedByUser] Access verified for albumId: ${albumId}`);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`[assertAlbumOwnedByUser] Unexpected error:`, error);
      throw new BadRequestException(`Failed to verify album access: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async create(data: {
    albumId: string;
    key: string;
    contentType: string;
    size?: number;
    userId: string;
    title?: string;
    description?: string;
    location?: string;
    story?: string;
    tags?: string[];
    isPublic?: boolean;
  }) {
    try {
      this.logger.log(`[create] Creating media for albumId: ${data.albumId}, userId: ${data.userId}, key: ${data.key}`);
      
      if (!data.key || data.key.trim().length === 0) {
        this.logger.error(`[create] Invalid key provided`);
        throw new BadRequestException('Media key is required');
      }

      if (!data.contentType || data.contentType.trim().length === 0) {
        this.logger.error(`[create] Invalid contentType provided`);
        throw new BadRequestException('Content type is required');
      }

      await this.assertAlbumOwnedByUser(data.albumId, data.userId);

      // Store as ObjectId going forward (keeps DB consistent)
      const albumIdObjectId = new Types.ObjectId(data.albumId);
      const userIdObjectId = new Types.ObjectId(data.userId);

      const media = await this.mediaModel.create({
        albumId: albumIdObjectId,
        userId: userIdObjectId,
        key: data.key,
        contentType: data.contentType,
        size: data.size,
        title: data.title,
        description: data.description,
        location: data.location,
        story: data.story,
        tags: data.tags,
        isPublic: typeof data.isPublic === 'boolean' ? data.isPublic : undefined,
      });

      this.logger.log(`[create] Media created successfully: ${media._id}`);

      const album = await this.albumModel.findById(data.albumId);
      if (!album) {
        // should be impossible because assertAlbumOwnedByUser already checked, but keep safe
        this.logger.error(`[create] Album not found after ownership check: ${data.albumId}`);
        throw new NotFoundException('Album not found');
      }

      // increment photo count
      album.photoCount += 1;
      this.logger.log(`[create] Updated album photoCount to: ${album.photoCount}`);

      // auto set cover image if missing
      if (!album.coverImage) {
        album.coverImage = data.key;
        this.logger.log(`[create] Set album coverImage to: ${data.key}`);
      }

      // album can only be public once it has media
      if (album.photoCount >= 1 && album.isPublicRequested) {
        album.isPublic = true;
        this.logger.log(`[create] Album is now public`);
      }

      await album.save();
      this.logger.log(`[create] Album updated successfully: ${data.albumId}`);

      return media;
    } catch (error) {
      this.logger.error(`[create] Error creating media for albumId ${data.albumId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  async findByAlbum(albumId: string, userId: string) {
    try {
      this.logger.log(`[findByAlbum] Fetching media for albumId: ${albumId}, userId: ${userId}`);
      
      await this.assertAlbumOwnedByUser(albumId, userId);
      
      const media = await this.mediaModel
        .find({
          ...this.albumIdFilter(albumId),
          // active media = not deleted (false or missing legacy field)
          isDeleted: { $ne: true },
        })
        .sort({ createdAt: -1 });

      this.logger.log(`[findByAlbum] Found ${media.length} media items for albumId: ${albumId}`);
      return media;
    } catch (error) {
      this.logger.error(`[findByAlbum] Error fetching media for albumId ${albumId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findArchivedByAlbum(albumId: string, userId: string) {
    try {
      this.logger.log(`[findArchivedByAlbum] Fetching archived media for albumId: ${albumId}, userId: ${userId}`);
      
      await this.assertAlbumOwnedByUser(albumId, userId);
      
      const media = await this.mediaModel
        .find({
          ...this.albumIdFilter(albumId),
          isDeleted: true,
        })
        .sort({ createdAt: -1 })
        .lean();
      
      this.logger.log(`[findArchivedByAlbum] Found ${media.length} archived media items for albumId: ${albumId}`);
      
      // Fetch album details
      const album = await this.albumModel.findById(albumId).lean();
      
      if (!album) {
        this.logger.warn(`[findArchivedByAlbum] Album not found: ${albumId}`);
      }
      
      return {
        media,
        album,
      };
    } catch (error) {
      this.logger.error(`[findArchivedByAlbum] Error fetching archived media for albumId ${albumId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch archived media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find all archived media for a user across all their albums.
   * Returns media with album details.
   */
  async findAllArchivedMedia(userId: string) {
    try {
      this.logger.log(`[findAllArchivedMedia] Fetching all archived media for userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(userId)) {
        this.logger.error(`[findAllArchivedMedia] Invalid userId: ${userId}`);
        throw new BadRequestException('Invalid userId');
      }
      
      // First, get all albums owned by the user (including archived albums)
      // Archived albums can also contain archived media, so we include them
      // IMPORTANT: some legacy records may store `userId` as a string instead of ObjectId.
      // So we match both variants.
      const userAlbums = await this.albumModel
        .find({
          $or: [
            { userId: new Types.ObjectId(userId) },
            // legacy: userId stored as string
            { userId: userId as unknown as any },
          ],
          // include albums where isDeleted is false or missing (legacy)
          isDeleted: { $ne: true },
          // Note: we intentionally do NOT filter by isArchived
        })
        .select('_id')
        .lean();

      const albumIds = userAlbums.map(album => album._id);
      this.logger.log(`[findAllArchivedMedia] Found ${albumIds.length} albums owned by user`);
      this.logger.debug(`[findAllArchivedMedia] Album IDs: ${albumIds.map(id => String(id)).join(', ')}`);
      
      if (albumIds.length === 0) {
        this.logger.log(`[findAllArchivedMedia] No albums found, returning empty array`);
        return [];
      }
      
      // Find all archived media in these albums
      // IMPORTANT: some legacy records may store `media.albumId` as a string instead of ObjectId.
      // So we match both variants.
      const albumIdStrings = albumIds.map((id) => String(id));
      const archivedMedia = await this.mediaModel
        .find({
          $or: [
            { albumId: { $in: albumIds } },
            // legacy: albumId stored as string
            { albumId: { $in: albumIdStrings as unknown as any[] } },
          ],
          // Archived media is represented by isDeleted: true (soft delete, keeps S3)
          isDeleted: true,
        })
        .sort({ createdAt: -1 })
        .lean();
      
      this.logger.log(`[findAllArchivedMedia] Found ${archivedMedia.length} archived media items`);
      
      // Get unique album IDs from the media
      const mediaAlbumIds = [...new Set(archivedMedia.map(m => String(m.albumId)))];
      
      // Fetch all album details
      const mediaAlbumObjectIds = mediaAlbumIds
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

      const albums =
        mediaAlbumObjectIds.length > 0
          ? await this.albumModel
              .find({
                _id: { $in: mediaAlbumObjectIds },
              })
              .lean()
          : [];
      
      // Create a map of albumId -> album for quick lookup
      const albumMap = new Map();
      albums.forEach(album => {
        albumMap.set(String(album._id), album);
      });
      
      // Attach album details to each media item
      const mediaWithAlbums = archivedMedia.map(media => ({
        ...media,
        album: albumMap.get(String(media.albumId)) || null,
      }));
      
      this.logger.log(`[findAllArchivedMedia] Returning ${mediaWithAlbums.length} media items with album details`);
      
      return mediaWithAlbums;
    } catch (error) {
      this.logger.error(`[findAllArchivedMedia] Error fetching archived media for userId ${userId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch archived media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /** Delete object from S3. No-op if key invalid or bucket missing. */
  private async deleteFromS3(key: string): Promise<void> {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket || !key) return;

    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    } catch (e) {
      // Log but don't fail media soft-delete if S3 fails (e.g. already gone)
      // eslint-disable-next-line no-console
      this.logger.error(`[deleteFromS3] S3 delete failed for key ${key}:`, e);
    }
  }

  /**
   * Archive media: soft delete (isDeleted: true), keep S3, not visible in album.
   * Only uploader can archive.
   */
  async archiveMedia(mediaId: string, userId: string) {
    try {
      this.logger.log(`[archiveMedia] Starting archive for mediaId: ${mediaId}, userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(mediaId)) {
        this.logger.error(`[archiveMedia] Invalid mediaId: ${mediaId}`);
        throw new BadRequestException('Invalid mediaId');
      }

      const media = await this.mediaModel.findById(mediaId);
      if (!media) {
        this.logger.error(`[archiveMedia] Media not found: ${mediaId}`);
        throw new NotFoundException('Media not found');
      }

      this.logger.log(`[archiveMedia] Found media: ${mediaId}, current isDeleted: ${media.isDeleted}, userId: ${media.userId}`);

      // Backward compatibility: set userId if missing
      if (!media.userId) {
        this.logger.log(`[archiveMedia] Media missing userId, setting from current user for backward compatibility`);
        media.userId = new Types.ObjectId(userId);
      }

      // Only the user who uploaded this media can archive it
      const uploaderId = media.userId != null ? String(media.userId) : null;
      if (uploaderId) {
        if (uploaderId !== String(userId)) {
          this.logger.error(`[archiveMedia] Permission denied: uploaderId ${uploaderId} !== userId ${userId}`);
          throw new ForbiddenException('Only the user who uploaded this media can archive it');
        }
      } else {
        this.logger.log(`[archiveMedia] No uploaderId, checking album ownership`);
        await this.assertAlbumOwnedByUser(String(media.albumId), userId);
      }

      if (media.isDeleted) {
        this.logger.log(`[archiveMedia] Media already archived: ${mediaId}`);
        return media;
      }

      // Soft delete: keep S3, just mark as deleted
      media.isDeleted = true;
      await media.save();
      this.logger.log(`[archiveMedia] Media archived successfully: ${mediaId}`);

      const album = await this.albumModel.findById(media.albumId);
      if (!album) {
        this.logger.warn(`[archiveMedia] Album not found: ${media.albumId}`);
        return media;
      }

      album.photoCount = Math.max(0, (album.photoCount ?? 0) - 1);
      this.logger.log(`[archiveMedia] Updated album photoCount to: ${album.photoCount}`);

      if (album.photoCount <= 0) {
        album.isPublic = false;
        this.logger.log(`[archiveMedia] Album is now private (no photos)`);
      }

      // If archived media was the cover, pick another non-deleted media in this album or reset to default
      if (album.coverImage === media.key) {
        const albumIdStr = String(media.albumId);
        const other = await this.mediaModel
          .findOne({ ...this.albumIdFilter(albumIdStr), isDeleted: { $ne: true } })
          .select('key')
          .lean();
        album.coverImage = other?.key ?? DEFAULT_ALBUM_COVER;
        this.logger.log(`[archiveMedia] Updated album coverImage to: ${album.coverImage}`);
      }

      await album.save();
      this.logger.log(`[archiveMedia] Album updated successfully: ${media.albumId}`);

      return media;
    } catch (error) {
      this.logger.error(`[archiveMedia] Error archiving media ${mediaId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to archive media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore archived media: unarchive it, make it visible in album again.
   * Only uploader can restore.
   */
  async restoreMedia(mediaId: string, userId: string) {
    try {
      this.logger.log(`[restoreMedia] Starting restore for mediaId: ${mediaId}, userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(mediaId)) {
        this.logger.error(`[restoreMedia] Invalid mediaId: ${mediaId}`);
        throw new BadRequestException('Invalid mediaId');
      }

      const media = await this.mediaModel.findById(mediaId);
      if (!media) {
        this.logger.error(`[restoreMedia] Media not found: ${mediaId}`);
        throw new NotFoundException('Media not found');
      }

      this.logger.log(`[restoreMedia] Found media: ${mediaId}, current isDeleted: ${media.isDeleted}, userId: ${media.userId}`);

      // Backward compatibility: set userId if missing
      if (!media.userId) {
        this.logger.log(`[restoreMedia] Media missing userId, setting from current user for backward compatibility`);
        media.userId = new Types.ObjectId(userId);
      }

      // Only the user who uploaded this media can restore it
      const uploaderId = media.userId != null ? String(media.userId) : null;
      if (uploaderId) {
        if (uploaderId !== String(userId)) {
          this.logger.error(`[restoreMedia] Permission denied: uploaderId ${uploaderId} !== userId ${userId}`);
          throw new ForbiddenException('Only the user who uploaded this media can restore it');
        }
      } else {
        this.logger.log(`[restoreMedia] No uploaderId, checking album ownership`);
        await this.assertAlbumOwnedByUser(String(media.albumId), userId);
      }

      if (!media.isDeleted) {
        this.logger.log(`[restoreMedia] Media already restored: ${mediaId}`);
        return media;
      }

      // Restore: unmark as deleted
      media.isDeleted = false;
      await media.save();
      this.logger.log(`[restoreMedia] Media restored successfully: ${mediaId}`);

      const album = await this.albumModel.findById(media.albumId);
      if (!album) {
        this.logger.warn(`[restoreMedia] Album not found: ${media.albumId}`);
        return media;
      }

      // Increment photo count
      album.photoCount += 1;
      this.logger.log(`[restoreMedia] Updated album photoCount to: ${album.photoCount}`);

      // Album can be public again if it has media and was requested
      if (album.photoCount >= 1 && album.isPublicRequested) {
        album.isPublic = true;
        this.logger.log(`[restoreMedia] Album is now public`);
      }

      await album.save();
      this.logger.log(`[restoreMedia] Album updated successfully: ${media.albumId}`);

      return media;
    } catch (error) {
      this.logger.error(`[restoreMedia] Error restoring media ${mediaId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to restore media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Hard delete media: remove from DB and S3 permanently.
   * Only uploader can delete.
   */
  async deleteMedia(mediaId: string, userId: string) {
    try {
      this.logger.log(`[deleteMedia] Starting delete for mediaId: ${mediaId}, userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(mediaId)) {
        this.logger.error(`[deleteMedia] Invalid mediaId: ${mediaId}`);
        throw new BadRequestException('Invalid mediaId');
      }

      const media = await this.mediaModel.findById(mediaId);
      if (!media) {
        this.logger.error(`[deleteMedia] Media not found: ${mediaId}`);
        throw new NotFoundException('Media not found');
      }

      this.logger.log(`[deleteMedia] Found media: ${mediaId}, userId: ${media.userId}, key: ${media.key}`);

      // Backward compatibility: set userId if missing
      if (!media.userId) {
        this.logger.log(`[deleteMedia] Media missing userId, setting from current user for backward compatibility`);
        media.userId = new Types.ObjectId(userId);
      }

      // Only the user who uploaded this media can delete it
      const uploaderId = media.userId != null ? String(media.userId) : null;
      if (uploaderId) {
        if (uploaderId !== String(userId)) {
          this.logger.error(`[deleteMedia] Permission denied: uploaderId ${uploaderId} !== userId ${userId}`);
          throw new ForbiddenException('Only the user who uploaded this media can delete it');
        }
      } else {
        this.logger.log(`[deleteMedia] No uploaderId, checking album ownership`);
        await this.assertAlbumOwnedByUser(String(media.albumId), userId);
      }

      const albumId = media.albumId;
      const albumIdStr = String(media.albumId);
      const key = media.key;

      // Delete from S3
      this.logger.log(`[deleteMedia] Deleting from S3: ${key}`);
      await this.deleteFromS3(key);

      // Delete from DB
      this.logger.log(`[deleteMedia] Deleting from database: ${mediaId}`);
      await this.mediaModel.findByIdAndDelete(mediaId);

      // Update album
      const album = await this.albumModel.findById(albumId);
      if (album) {
        album.photoCount = Math.max(0, (album.photoCount ?? 0) - 1);
        this.logger.log(`[deleteMedia] Updated album photoCount to: ${album.photoCount}`);

        if (album.photoCount <= 0) {
          album.isPublic = false;
          this.logger.log(`[deleteMedia] Album is now private (no photos)`);
        }

        // If deleted media was the cover, pick another non-deleted media in this album or reset to default
        if (album.coverImage === key) {
          const other = await this.mediaModel
          .findOne({ ...this.albumIdFilter(albumIdStr), isDeleted: { $ne: true } })
            .select('key')
            .lean();
          album.coverImage = other?.key ?? DEFAULT_ALBUM_COVER;
          this.logger.log(`[deleteMedia] Updated album coverImage to: ${album.coverImage}`);
        }

        await album.save();
        this.logger.log(`[deleteMedia] Album updated successfully: ${albumId}`);
      } else {
        this.logger.warn(`[deleteMedia] Album not found: ${albumId}`);
      }

      this.logger.log(`[deleteMedia] Media deleted successfully: ${mediaId}`);
      return { deleted: true };
    } catch (error) {
      this.logger.error(`[deleteMedia] Error deleting media ${mediaId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateTags(mediaId: string, userId: string, tags: string[]) {
    try {
      this.logger.log(`[updateTags] Updating tags for mediaId: ${mediaId}, userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(mediaId)) {
        this.logger.error(`[updateTags] Invalid mediaId: ${mediaId}`);
        throw new BadRequestException('Invalid mediaId');
      }

      if (!Array.isArray(tags)) {
        this.logger.error(`[updateTags] Tags must be an array`);
        throw new BadRequestException('Tags must be an array');
      }

      const media = await this.mediaModel.findById(mediaId);
      if (!media || media.isDeleted) {
        this.logger.warn(`[updateTags] Media not found or deleted: ${mediaId}`);
        throw new NotFoundException('Media not found');
      }

      await this.assertAlbumOwnedByUser(String(media.albumId), userId);

      media.tags = tags;
      await media.save();
      
      this.logger.log(`[updateTags] Tags updated successfully for mediaId: ${mediaId}, tags count: ${tags.length}`);
      return media;
    } catch (error) {
      this.logger.error(`[updateTags] Error updating tags for mediaId ${mediaId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateDetails(mediaId: string, userId: string, details: UpdateMediaDetailsDto) {
    try {
      this.logger.log(`[updateDetails] Updating details for mediaId: ${mediaId}, userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(mediaId)) {
        this.logger.error(`[updateDetails] Invalid mediaId: ${mediaId}`);
        throw new BadRequestException('Invalid mediaId');
      }

      const media = await this.mediaModel.findById(mediaId);
      if (!media || media.isDeleted) {
        this.logger.warn(`[updateDetails] Media not found or deleted: ${mediaId}`);
        throw new NotFoundException('Media not found');
      }

      await this.assertAlbumOwnedByUser(String(media.albumId), userId);

      const changes: string[] = [];
      if (typeof details.title !== 'undefined') {
        media.title = details.title;
        changes.push('title');
      }
      if (typeof details.description !== 'undefined') {
        media.description = details.description;
        changes.push('description');
      }
      if (typeof details.location !== 'undefined') {
        media.location = details.location;
        changes.push('location');
      }
      if (typeof details.story !== 'undefined') {
        media.story = details.story;
        changes.push('story');
      }
      if (typeof details.isPublic !== 'undefined') {
        media.isPublic = details.isPublic;
        changes.push('isPublic');
      }
      if (typeof details.tags !== 'undefined') {
        media.tags = details.tags ?? [];
        changes.push('tags');
      }

      if (changes.length === 0) {
        this.logger.warn(`[updateDetails] No valid fields to update for mediaId: ${mediaId}`);
        throw new BadRequestException('No valid fields to update');
      }

      await media.save();
      this.logger.log(`[updateDetails] Media details updated successfully: ${mediaId}, changes: ${changes.join(', ')}`);
      return media;
    } catch (error) {
      this.logger.error(`[updateDetails] Error updating details for mediaId ${mediaId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update media details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async setAsAlbumCover(mediaId: string, userId: string) {
    try {
      this.logger.log(`[setAsAlbumCover] Setting media as album cover: ${mediaId}, userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(mediaId)) {
        this.logger.error(`[setAsAlbumCover] Invalid mediaId: ${mediaId}`);
        throw new BadRequestException('Invalid mediaId');
      }

      const media = await this.mediaModel.findById(mediaId);
      if (!media || media.isDeleted) {
        this.logger.warn(`[setAsAlbumCover] Media not found or deleted: ${mediaId}`);
        throw new NotFoundException('Media not found');
      }

      await this.assertAlbumOwnedByUser(String(media.albumId), userId);

      const album = await this.albumModel.findById(media.albumId);
      if (!album) {
        this.logger.error(`[setAsAlbumCover] Album not found: ${media.albumId}`);
        throw new NotFoundException('Album not found');
      }

      album.coverImage = media.key;
      await album.save();
      
      this.logger.log(`[setAsAlbumCover] Album cover updated successfully: ${media.albumId}, coverImage: ${media.key}`);
      return album;
    } catch (error) {
      this.logger.error(`[setAsAlbumCover] Error setting album cover for mediaId ${mediaId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to set album cover: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an S3 object by key. Used for story-only images (no media record).
   * Only the album owner can delete. Key must be under albums/{albumId}/.
   */
  async deleteS3ObjectByKey(albumId: string, key: string, userId: string): Promise<void> {
    try {
      this.logger.log(`[deleteS3ObjectByKey] Deleting S3 object: ${key}, albumId: ${albumId}, userId: ${userId}`);
      
      await this.assertAlbumOwnedByUser(albumId, userId);

      const prefix = `albums/${albumId}/`;
      if (!key || !key.startsWith(prefix) || key.includes('..')) {
        this.logger.error(`[deleteS3ObjectByKey] Invalid key for album: ${key}, expected prefix: ${prefix}`);
        throw new BadRequestException('Invalid key for this album');
      }

      await this.deleteFromS3(key);
      this.logger.log(`[deleteS3ObjectByKey] S3 object deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`[deleteS3ObjectByKey] Error deleting S3 object ${key}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete S3 object: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
