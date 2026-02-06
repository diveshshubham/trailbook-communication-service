import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../models/user.schema';
import {
  UserProfile,
  UserProfileDocument,
} from '../../models/user-profile.schema';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { Album, AlbumDocument } from '../../models/albums.schema';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name)
    private userProfileModel: Model<UserProfileDocument>,
    @InjectModel(Album.name) private albumModel: Model<AlbumDocument>,
  ) {}

  findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  findByPhone(phone: string) {
    return this.userModel.findOne({ phone });
  }

  async upsertUser(data: Partial<User>) {
    const email = typeof data.email === 'string' ? data.email.trim() : undefined;
    const phone = typeof data.phone === 'string' ? data.phone.trim() : undefined;

    const query = email ? { email } : phone ? { phone } : null;
    if (!query) {
      throw new BadRequestException('Email or phone required');
    }

    const setOnInsert: Partial<User> = {};
    if (email) setOnInsert.email = email;
    if (phone) setOnInsert.phone = phone;

    return this.userModel.findOneAndUpdate(
      query,
      { $setOnInsert: setOnInsert },
      { upsert: true, new: true },
    );
  }

  updateOtp(userId: string | any, otp: string, expiresAt: Date) {
    return this.userModel.findByIdAndUpdate(userId, {
      otp,
      otpExpiresAt: expiresAt,
    });
  }
  
  verifyOtp(userId: string | any) {
    return this.userModel.findByIdAndUpdate(userId, {
      otp: null,
      otpExpiresAt: null,
      isVerified: true,
    });
  }

  async getMe(userId: string) {
    const [user, profile] = await Promise.all([
      this.userModel.findById(userId).lean(),
      this.userProfileModel.findOne({ userId }).lean(),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { user, profile };
  }

  private isDuplicateKeyError(err: any) {
    return (
      err &&
      (err.code === 11000 || err?.name === 'MongoServerError') &&
      typeof err.message === 'string' &&
      err.message.includes('E11000')
    );
  }

  async updateMe(userId: string, dto: UpdateMyProfileDto) {
    const email =
      typeof dto.email === 'string' ? dto.email.trim().toLowerCase() : undefined;
    const phoneRaw =
      typeof dto.phone === 'string'
        ? dto.phone
        : typeof dto.mobileNumber === 'string'
          ? dto.mobileNumber
          : undefined;
    const phone = typeof phoneRaw === 'string' ? phoneRaw.trim() : undefined;

    const userSet: Partial<User> = {};
    if (typeof email !== 'undefined') userSet.email = email;
    if (typeof phone !== 'undefined') userSet.phone = phone;

    let user: any = null;
    if (Object.keys(userSet).length > 0) {
      try {
        user = await this.userModel
          .findByIdAndUpdate(userId, { $set: userSet }, { new: true })
          .lean();
      } catch (err: any) {
        if (this.isDuplicateKeyError(err)) {
          throw new BadRequestException('Email or phone already in use');
        }
        throw err;
      }
    } else {
      user = await this.userModel.findById(userId).lean();
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profileSet: Partial<UserProfile> = {};
    if (typeof dto.fullName !== 'undefined') profileSet.fullName = dto.fullName;
    if (typeof dto.bio !== 'undefined') profileSet.bio = dto.bio;
    if (typeof dto.description !== 'undefined' && typeof dto.bio === 'undefined')
      profileSet.bio = dto.description;
    if (typeof dto.dob !== 'undefined') profileSet.dob = new Date(dto.dob);
    if (typeof dto.location !== 'undefined') profileSet.location = dto.location;
    if (typeof dto.experience !== 'undefined')
      profileSet.experience = dto.experience;
    if (typeof dto.website !== 'undefined') profileSet.website = dto.website;
    if (typeof dto.tags !== 'undefined') profileSet.tags = dto.tags as any;
    if (typeof dto.favoriteAlbumIds !== 'undefined')
      profileSet.favoriteAlbumIds = dto.favoriteAlbumIds as any;
    if (typeof dto.favoriteMediaIds !== 'undefined')
      profileSet.favoriteMediaIds = dto.favoriteMediaIds as any;

    const profile =
      Object.keys(profileSet).length > 0
        ? await this.userProfileModel
            .findOneAndUpdate(
              { userId },
              { $set: profileSet, $setOnInsert: { userId } },
              { upsert: true, new: true },
            )
            .lean()
        : await this.userProfileModel.findOne({ userId }).lean();

    return { user, profile };
  }

  async updateProfilePicture(userId: string, profilePicture: string) {
    return this.userProfileModel
      .findOneAndUpdate(
        { userId },
        { $set: { profilePicture }, $setOnInsert: { userId } },
        { upsert: true, new: true },
      )
      .lean();
  }

  /**
   * Get public albums for a user with user profile
   * This endpoint is accessible without authentication
   */
  async getPublicAlbums(userId: string) {
    try {
      this.logger.log(`[getPublicAlbums] Fetching public albums for userId: ${userId}`);

      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);

      // Get user profile (basic details only) - optional, don't fail if not found
      // Handle both ObjectId and string formats for backward compatibility
      const profile = await this.userProfileModel
        .findOne({
          $or: [
            { userId: userIdObjectId },
            { userId: userId as unknown as any },
          ],
        })
        .select('fullName profilePicture')
        .lean();

      // Get public albums
      const albums = await this.albumModel
        .find({
          $or: [
            { userId: userIdObjectId },
            { userId: userId as unknown as any },
          ],
          isPublic: true,
          isDeleted: { $ne: true },
          isArchived: { $ne: true },
        })
        .select('_id title description location story coverImage photoCount createdAt')
        .sort({ createdAt: -1 })
        .lean();

      this.logger.log(
        `[getPublicAlbums] Found ${albums.length} public albums for userId: ${userId}`,
      );

      return {
        profile: profile
          ? {
              fullName: profile.fullName,
              profilePicture: profile.profilePicture,
            }
          : null,
        albums: albums.map((album: any) => ({
          _id: album._id,
          title: album.title,
          description: album.description,
          location: album.location,
          story: album.story,
          coverImage: album.coverImage,
          photoCount: album.photoCount || 0,
          createdAt: album.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error(
        `[getPublicAlbums] Error fetching public albums for userId ${userId}:`,
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch public albums: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get public user profile and public albums
   * This endpoint is accessible without authentication for viewing public profiles
   */
  async getPublicProfile(userId: string) {
    try {
      this.logger.log(`[getPublicProfile] Fetching public profile for userId: ${userId}`);

      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const userIdObjectId = new Types.ObjectId(userId);

      // Get user profile (basic details only)
      // Handle both ObjectId and string formats for backward compatibility
      const profile = await this.userProfileModel
        .findOne({
          $or: [
            { userId: userIdObjectId },
            { userId: userId as unknown as any },
          ],
        })
        .select('fullName bio location experience profilePicture tags')
        .lean();

      if (!profile) {
        throw new NotFoundException('User profile not found');
      }

      // Get public albums
      const albums = await this.albumModel
        .find({
          $or: [
            { userId: userIdObjectId },
            { userId: userId as unknown as any },
          ],
          isPublic: true,
          isDeleted: { $ne: true },
          isArchived: { $ne: true },
        })
        .select('_id title description location story coverImage photoCount createdAt')
        .sort({ createdAt: -1 })
        .lean();

      this.logger.log(
        `[getPublicProfile] Found ${albums.length} public albums for userId: ${userId}`,
      );

      return {
        profile: {
          fullName: profile.fullName,
          bio: profile.bio,
          location: profile.location,
          experience: profile.experience,
          profilePicture: profile.profilePicture,
          tags: profile.tags || [],
        },
        albums: albums.map((album: any) => ({
          _id: album._id,
          title: album.title,
          description: album.description,
          location: album.location,
          story: album.story,
          coverImage: album.coverImage,
          photoCount: album.photoCount || 0,
          createdAt: album.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error(
        `[getPublicProfile] Error fetching public profile for userId ${userId}:`,
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch public profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
