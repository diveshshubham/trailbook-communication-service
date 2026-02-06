import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Album, AlbumDocument } from '../../models/albums.schema';
import { AlbumFavorite, AlbumFavoriteDocument } from '../../models/album-favorite.schema';
import { UserProfile, UserProfileDocument } from '../../models/user-profile.schema';
const DEFAULT_ALBUM_COVER = 'https://picsum.photos/seed/picsum/200/300';


@Injectable()
export class AlbumsService {
  private readonly logger = new Logger(AlbumsService.name);

  constructor(
    @InjectModel(Album.name) private albumModel: Model<AlbumDocument>,
    @InjectModel(AlbumFavorite.name) private favoriteModel: Model<AlbumFavoriteDocument>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
  ) {}

  async create(data: {
    title: string;
    description?: string;
    location?: string;
    story?: string;
    coverImage?: string;
    isPublic?: boolean;
    userId: string;
  }) {
    try {
      this.logger.log(`[create] Creating album for userId: ${data.userId}, title: ${data.title}`);
      
      if (!data.title || data.title.trim().length === 0) {
        this.logger.error(`[create] Invalid title provided`);
        throw new BadRequestException('Album title is required');
      }

      if (!Types.ObjectId.isValid(data.userId)) {
        this.logger.error(`[create] Invalid userId: ${data.userId}`);
        throw new BadRequestException('Invalid userId');
      }

      // Store as ObjectId going forward (keeps DB consistent)
      const userIdObjectId = new Types.ObjectId(data.userId);

      const album = await this.albumModel.create({
        title: data.title,
        description: data.description,
        location: data.location,
        story: data.story,
        userId: userIdObjectId,
        // albums always start private; if the user wants public, we store intent and
        // enable public once the album has media
        isPublic: false,
        isPublicRequested: Boolean(data.isPublic),
        coverImage: data.coverImage ?? DEFAULT_ALBUM_COVER,
        photoCount: 0,
      });

      this.logger.log(`[create] Album created successfully: ${album._id}`);
      return album;
    } catch (error) {
      this.logger.error(`[create] Error creating album for userId ${data.userId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create album: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findMyAlbums(userId: string) {
    try {
      this.logger.log(`[findMyAlbums] Fetching albums for userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(userId)) {
        this.logger.error(`[findMyAlbums] Invalid userId: ${userId}`);
        throw new BadRequestException('Invalid userId');
      }

      // IMPORTANT: legacy records may store `userId` as string in Mongo.
      // Query for both ObjectId and string to be backward compatible.
      const userIdObjectId = new Types.ObjectId(userId);

      const albums = await this.albumModel
        .find({
          $or: [
            { userId: userIdObjectId },
            // legacy: userId stored as string
            { userId: userId as unknown as any },
          ],
          // include albums where isDeleted/isArchived are false OR missing (legacy)
          isDeleted: { $ne: true },
          isArchived: { $ne: true },
        })
        .sort({ createdAt: -1 })
        .lean(); // lean = faster, plain objects

      this.logger.log(`[findMyAlbums] Found ${albums.length} albums for userId: ${userId}`);
      return albums;
    } catch (error) {
      this.logger.error(`[findMyAlbums] Error fetching albums for userId ${userId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch albums: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findArchivedAlbums(userId: string) {
    try {
      this.logger.log(`[findArchivedAlbums] Fetching archived albums for userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(userId)) {
        this.logger.error(`[findArchivedAlbums] Invalid userId: ${userId}`);
        throw new BadRequestException('Invalid userId');
      }

      // IMPORTANT: legacy records may store `userId` as string in Mongo.
      // Query for both ObjectId and string to be backward compatible.
      const userIdObjectId = new Types.ObjectId(userId);

      const albums = await this.albumModel
        .find({
          $or: [
            { userId: userIdObjectId },
            // legacy: userId stored as string
            { userId: userId as unknown as any },
          ],
          // include albums where isDeleted is false OR missing (legacy)
          isDeleted: { $ne: true },
          isArchived: true,
        })
        .sort({ createdAt: -1 })
        .lean();

      this.logger.log(`[findArchivedAlbums] Found ${albums.length} archived albums for userId: ${userId}`);
      return albums;
    } catch (error) {
      this.logger.error(`[findArchivedAlbums] Error fetching archived albums for userId ${userId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch archived albums: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async findOwnedAlbum(albumId: string, userId: string) {
    try {
      this.logger.debug(`[findOwnedAlbum] Checking ownership for albumId: ${albumId}, userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(albumId)) {
        this.logger.error(`[findOwnedAlbum] Invalid albumId: ${albumId}`);
        throw new BadRequestException('Invalid albumId');
      }

      if (!Types.ObjectId.isValid(userId)) {
        this.logger.error(`[findOwnedAlbum] Invalid userId: ${userId}`);
        throw new BadRequestException('Invalid userId');
      }

      const album = await this.albumModel.findById(albumId);
      if (!album) {
        this.logger.warn(`[findOwnedAlbum] Album not found: ${albumId}`);
        throw new NotFoundException('Album not found');
      }

      if (String(album.userId) !== String(userId)) {
        this.logger.warn(`[findOwnedAlbum] Access denied: userId ${userId} does not own album ${albumId}`);
        throw new ForbiddenException('You do not have access to this album');
      }

      this.logger.debug(`[findOwnedAlbum] Ownership verified for albumId: ${albumId}`);
      return album;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`[findOwnedAlbum] Unexpected error checking ownership:`, error);
      throw new BadRequestException(`Failed to verify album ownership: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async assertAlbumOwnedByUser(albumId: string, userId: string) {
    try {
      await this.findOwnedAlbum(albumId, userId);
    } catch (error) {
      // Re-throw as-is since findOwnedAlbum already handles logging
      throw error;
    }
  }

  async setCoverImage(albumId: string, userId: string, coverImage: string) {
    try {
      this.logger.log(`[setCoverImage] Setting cover image for albumId: ${albumId}, userId: ${userId}`);
      
      if (!coverImage || coverImage.trim().length === 0) {
        this.logger.error(`[setCoverImage] Invalid coverImage provided`);
        throw new BadRequestException('Cover image is required');
      }

      const album = await this.findOwnedAlbum(albumId, userId);
      album.coverImage = coverImage;
      await album.save();
      
      this.logger.log(`[setCoverImage] Cover image updated successfully for albumId: ${albumId}`);
      return album;
    } catch (error) {
      this.logger.error(`[setCoverImage] Error setting cover image for albumId ${albumId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to set cover image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async requestVisibility(albumId: string, userId: string, isPublic: boolean) {
    try {
      this.logger.log(`[requestVisibility] Updating visibility for albumId: ${albumId}, userId: ${userId}, isPublic: ${isPublic}`);
      
      const album = await this.findOwnedAlbum(albumId, userId);

      if (isPublic) {
        album.isPublicRequested = true;
        // cannot be public unless it has media; schema pre-save will also enforce this
        if ((album.photoCount ?? 0) > 0) {
          album.isPublic = true;
          this.logger.log(`[requestVisibility] Album set to public (has ${album.photoCount} photos)`);
        } else {
          album.isPublic = false;
          this.logger.log(`[requestVisibility] Album remains private (no photos yet)`);
        }
      } else {
        album.isPublic = false;
        album.isPublicRequested = false;
        this.logger.log(`[requestVisibility] Album set to private`);
      }

      await album.save();
      this.logger.log(`[requestVisibility] Visibility updated successfully for albumId: ${albumId}`);
      return album;
    } catch (error) {
      this.logger.error(`[requestVisibility] Error updating visibility for albumId ${albumId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update visibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateDetails(
    albumId: string,
    userId: string,
    patch: {
      title?: string;
      description?: string;
      location?: string;
      story?: string;
      isPublic?: boolean;
    },
  ) {
    try {
      this.logger.log(`[updateDetails] Updating album details for albumId: ${albumId}, userId: ${userId}`);
      
      const album = await this.findOwnedAlbum(albumId, userId);

      let changed = false;
      const changes: string[] = [];

      if (typeof patch.title === 'string' && patch.title.trim().length > 0) {
        album.title = patch.title;
        changed = true;
        changes.push('title');
      }
      if (typeof patch.description === 'string' && patch.description.trim().length > 0) {
        album.description = patch.description;
        changed = true;
        changes.push('description');
      }
      if (typeof patch.location === 'string' && patch.location.trim().length > 0) {
        album.location = patch.location;
        changed = true;
        changes.push('location');
      }
      if (typeof patch.story === 'string' && patch.story.trim().length > 0) {
        album.story = patch.story;
        changed = true;
        changes.push('story');
      }

      if (typeof patch.isPublic === 'boolean') {
        if (patch.isPublic) {
          album.isPublicRequested = true;
          album.isPublic = (album.photoCount ?? 0) > 0;
          this.logger.log(`[updateDetails] Visibility requested: ${album.isPublic ? 'public' : 'private (no photos)'}`);
        } else {
          album.isPublic = false;
          album.isPublicRequested = false;
        }
        changed = true;
        changes.push('isPublic');
      }

      if (!changed) {
        this.logger.warn(`[updateDetails] No valid fields to update for albumId: ${albumId}`);
        throw new BadRequestException('No valid fields to update');
      }

      await album.save();
      this.logger.log(`[updateDetails] Album updated successfully: ${albumId}, changes: ${changes.join(', ')}`);
      return album;
    } catch (error) {
      this.logger.error(`[updateDetails] Error updating album details for albumId ${albumId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update album: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Archive album: hidden from user's list but still public and accessible.
   * Only album owner can archive.
   */
  async archiveAlbum(albumId: string, userId: string) {
    try {
      this.logger.log(`[archiveAlbum] Archiving album: ${albumId}, userId: ${userId}`);
      
      const album = await this.findOwnedAlbum(albumId, userId);

      if (album.isArchived) {
        this.logger.log(`[archiveAlbum] Album already archived: ${albumId}`);
        return album;
      }

      album.isArchived = true;
      // Keep isPublic as is - archived albums remain visible to public
      await album.save();

      this.logger.log(`[archiveAlbum] Album archived successfully: ${albumId}`);
      return album;
    } catch (error) {
      this.logger.error(`[archiveAlbum] Error archiving album ${albumId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to archive album: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore archived album: unarchive it, make it visible in user's list again.
   * Only album owner can restore.
   */
  async restoreAlbum(albumId: string, userId: string) {
    try {
      this.logger.log(`[restoreAlbum] Restoring album: ${albumId}, userId: ${userId}`);
      
      const album = await this.findOwnedAlbum(albumId, userId);

      if (!album.isArchived) {
        this.logger.log(`[restoreAlbum] Album not archived: ${albumId}`);
        return album;
      }

      album.isArchived = false;
      await album.save();

      this.logger.log(`[restoreAlbum] Album restored successfully: ${albumId}`);
      return album;
    } catch (error) {
      this.logger.error(`[restoreAlbum] Error restoring album ${albumId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to restore album: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Hard delete album: permanently remove from DB.
   * Only album owner can delete.
   */
  async deleteAlbum(albumId: string, userId: string) {
    try {
      this.logger.log(`[deleteAlbum] Deleting album: ${albumId}, userId: ${userId}`);
      
      const album = await this.findOwnedAlbum(albumId, userId);

      // Mark as deleted (soft delete for safety, or hard delete)
      // For now, we'll do soft delete to be safe, but you can change to findByIdAndDelete for hard delete
      album.isDeleted = true;
      await album.save();

      this.logger.log(`[deleteAlbum] Album deleted successfully: ${albumId}`);
      
      // Optionally: hard delete all media in this album
      // This would require injecting MediaModel - leaving it for now

      return { deleted: true };
    } catch (error) {
      this.logger.error(`[deleteAlbum] Error deleting album ${albumId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete album: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add album to favorites (Worth keeping).
   * User can favorite their own albums or any public album.
   */
  async addFavorite(albumId: string, userId: string) {
    try {
      this.logger.log(`[addFavorite] Adding album to favorites: albumId=${albumId}, userId=${userId}`);
      
      if (!Types.ObjectId.isValid(albumId)) {
        this.logger.error(`[addFavorite] Invalid albumId: ${albumId}`);
        throw new BadRequestException('Invalid albumId');
      }

      if (!Types.ObjectId.isValid(userId)) {
        this.logger.error(`[addFavorite] Invalid userId: ${userId}`);
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);
      const albumIdObjectId = new Types.ObjectId(albumId);

      // Check if album exists and is accessible (public or owned by user)
      const album = await this.albumModel
        .findOne({
          _id: albumIdObjectId,
          isDeleted: { $ne: true },
          $or: [
            { userId: userIdObjectId }, // User's own album
            { userId: userId as unknown as any }, // Legacy: userId as string
            { isPublic: true }, // Public album
          ],
        })
        .lean();

      if (!album) {
        this.logger.warn(`[addFavorite] Album not found or not accessible: ${albumId}`);
        throw new NotFoundException('Album not found or not accessible. You can only favorite your own albums or public albums.');
      }

      // Check if already favorited (using compound index for fast lookup)
      const existing = await this.favoriteModel
        .findOne({
          userId: userIdObjectId,
          albumId: albumIdObjectId,
        })
        .lean();

      if (existing) {
        this.logger.log(`[addFavorite] Album already in favorites: ${albumId}`);
        return { favorited: true, message: 'Album already in favorites' };
      }

      // Add to favorites
      await this.favoriteModel.create({
        userId: userIdObjectId,
        albumId: albumIdObjectId,
      });

      this.logger.log(`[addFavorite] Album added to favorites successfully: ${albumId}`);
      return { favorited: true, message: 'Album added to favorites' };
    } catch (error) {
      this.logger.error(`[addFavorite] Error adding favorite for albumId ${albumId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      // Handle duplicate key error (unique index violation)
      if (error instanceof Error && error.message.includes('duplicate key')) {
        this.logger.warn(`[addFavorite] Duplicate favorite attempt: ${albumId}`);
        return { favorited: true, message: 'Album already in favorites' };
      }
      throw new BadRequestException(`Failed to add favorite: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove album from favorites.
   */
  async removeFavorite(albumId: string, userId: string) {
    try {
      this.logger.log(`[removeFavorite] Removing album from favorites: albumId=${albumId}, userId=${userId}`);
      
      if (!Types.ObjectId.isValid(albumId)) {
        this.logger.error(`[removeFavorite] Invalid albumId: ${albumId}`);
        throw new BadRequestException('Invalid albumId');
      }

      if (!Types.ObjectId.isValid(userId)) {
        this.logger.error(`[removeFavorite] Invalid userId: ${userId}`);
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);
      const albumIdObjectId = new Types.ObjectId(albumId);

      const result = await this.favoriteModel.deleteOne({
        userId: userIdObjectId,
        albumId: albumIdObjectId,
      });

      if (result.deletedCount === 0) {
        this.logger.warn(`[removeFavorite] Favorite not found: albumId=${albumId}, userId=${userId}`);
        return { removed: false, message: 'Album was not in favorites' };
      }

      this.logger.log(`[removeFavorite] Album removed from favorites successfully: ${albumId}`);
      return { removed: true, message: 'Album removed from favorites' };
    } catch (error) {
      this.logger.error(`[removeFavorite] Error removing favorite for albumId ${albumId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to remove favorite: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all favorite albums for a user.
   * Optimized with aggregation for fast queries.
   */
  async getFavorites(userId: string) {
    try {
      this.logger.log(`[getFavorites] Fetching favorite albums for userId: ${userId}`);
      
      if (!Types.ObjectId.isValid(userId)) {
        this.logger.error(`[getFavorites] Invalid userId: ${userId}`);
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);

      // Optimized: Get favorite albumIds first (using index)
      const favorites = await this.favoriteModel
        .find({ userId: userIdObjectId })
        .select('albumId createdAt')
        .sort({ createdAt: -1 })
        .lean();

      if (favorites.length === 0) {
        this.logger.log(`[getFavorites] No favorites found for userId: ${userId}`);
        return [];
      }

      const albumIds = favorites.map(fav => fav.albumId);
      const favoriteMap = new Map(
        favorites.map(fav => [
          String(fav.albumId),
          (fav as any).createdAt || new Date(fav._id.getTimestamp()),
        ])
      );

      // Fetch albums in one query (optimized with lean)
      // Include both ObjectId and string formats for backward compatibility
      const albums = await this.albumModel
        .find({
          $or: [
            { _id: { $in: albumIds } },
            { _id: { $in: albumIds.map(id => String(id)) as unknown as any[] } },
          ],
          isDeleted: { $ne: true },
        })
        .lean()
        .sort({ createdAt: -1 });

      // Get unique user IDs from albums (for fetching user profiles)
      const albumOwnerIds = [...new Set(albums.map(album => album.userId))];
      
      // Handle both ObjectId and string formats for backward compatibility
      const albumOwnerObjectIds: Types.ObjectId[] = [];
      const albumOwnerStrings: string[] = [];
      
      albumOwnerIds.forEach(id => {
        if (id instanceof Types.ObjectId) {
          albumOwnerObjectIds.push(id);
          albumOwnerStrings.push(String(id));
        } else if (Types.ObjectId.isValid(String(id))) {
          albumOwnerObjectIds.push(new Types.ObjectId(String(id)));
          albumOwnerStrings.push(String(id));
        } else {
          albumOwnerStrings.push(String(id));
        }
      });

      // Fetch user profiles in one optimized query (match both ObjectId and string)
      const userProfiles = albumOwnerObjectIds.length > 0
        ? await this.userProfileModel
            .find({
              $or: [
                { userId: { $in: albumOwnerObjectIds } },
                { userId: { $in: albumOwnerStrings as unknown as any[] } },
              ],
            })
            .select('userId fullName bio profilePicture location')
            .lean()
        : [];

      this.logger.debug(`[getFavorites] Found ${userProfiles.length} user profiles out of ${albumOwnerObjectIds.length} unique users`);

      // Create a map of userId -> userProfile for fast lookup
      // Use both ObjectId and string keys to handle both formats
      const userProfileMap = new Map();
      userProfiles.forEach(profile => {
        const profileUserId = profile.userId;
        const profileUserIdStr = String(profileUserId);
        
        const profileData = {
          fullName: profile.fullName,
          bio: profile.bio,
          profilePicture: profile.profilePicture,
          location: profile.location,
        };
        
        // Store with normalized string key (always use string for consistency)
        // This ensures we can find profiles regardless of how album.userId is stored
        userProfileMap.set(profileUserIdStr, profileData);
        
        // Also store with ObjectId.toString() if it's an ObjectId (for extra safety)
        if (profileUserId instanceof Types.ObjectId) {
          userProfileMap.set(profileUserId.toString(), profileData);
        }
      });

      // Sort by favorite creation date (most recently favorited first)
      const sortedAlbums = albums
        .map(album => {
          const albumUserId = album.userId;
          const albumUserIdStr = String(albumUserId);
          const isOwnAlbum = albumUserIdStr === userId || String(userIdObjectId) === albumUserIdStr;
          
          // Lookup user profile - normalize to string for consistent matching
          let userProfile = userProfileMap.get(albumUserIdStr) || null;
          
          // If not found, try with ObjectId.toString() conversion
          if (!userProfile && albumUserId instanceof Types.ObjectId) {
            userProfile = userProfileMap.get(albumUserId.toString()) || null;
          }
          
          // If still not found and it's a valid ObjectId string, try converting it
          if (!userProfile && Types.ObjectId.isValid(albumUserIdStr)) {
            try {
              const albumUserIdObj = new Types.ObjectId(albumUserIdStr);
              userProfile = userProfileMap.get(albumUserIdObj.toString()) || null;
            } catch (e) {
              // ignore conversion errors
            }
          }
          
          // Debug logging if profile not found (helps troubleshoot missing profiles)
          if (!userProfile) {
            this.logger.debug(`[getFavorites] No profile found for album userId: ${albumUserIdStr} (albumId: ${album._id}), map keys: ${Array.from(userProfileMap.keys()).slice(0, 5).join(', ')}`);
          }

          return {
            ...album,
            favoritedAt: favoriteMap.get(String(album._id)),
            isOwnAlbum, // Flag indicating if this album belongs to the current user
            user: userProfile ? {
              fullName: userProfile.fullName,
              bio: userProfile.bio,
              profilePicture: userProfile.profilePicture,
              location: userProfile.location,
            } : null,
          };
        })
        .sort((a, b) => {
          const dateA = a.favoritedAt?.getTime() ?? 0;
          const dateB = b.favoritedAt?.getTime() ?? 0;
          return dateB - dateA; // Descending (newest first)
        });

      this.logger.log(`[getFavorites] Found ${sortedAlbums.length} favorite albums for userId: ${userId}`);
      return sortedAlbums;
    } catch (error) {
      this.logger.error(`[getFavorites] Error fetching favorites for userId ${userId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch favorites: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
