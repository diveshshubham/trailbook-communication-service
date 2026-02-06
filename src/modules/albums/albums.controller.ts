import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { AlbumsService } from './albums.service';
import { ApiResponse } from '../../utils/api-response';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumCoverDto } from './dto/update-album-cover.dto';
import { UpdateAlbumVisibilityDto } from './dto/update-album-visibility.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { FavoriteAlbumDto } from './dto/favorite-album.dto';
import { Inject } from '@nestjs/common';
import { S3_CLIENT } from '../../common/s3/s3.provider';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';


@Controller('albums')
@UseGuards(JwtAuthGuard)
export class AlbumsController {
  constructor(
    private albumsService: AlbumsService,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
  ) {}

  @Post()
  async create(@Body() body: CreateAlbumDto, @Req() req) {
    const title = body.title ?? body.name;
    if (!title) {
      throw new BadRequestException('Album name is required');
    }

    const album = await this.albumsService.create({
      title,
      description: body.description,
      location: body.location,
      story: body.story,
      coverImage: body.coverImage,
      isPublic: body.isPublic,
      userId: req.user.sub,
    });

    return ApiResponse.success('Album created', { album });
  }

  @Get('me')
  async getMyAlbums(@Req() req) {
    const albums = await this.albumsService.findMyAlbums(req.user.sub);

    return ApiResponse.success(
      'Albums fetched successfully',
      { albums },
    );
  }

  @Get('archived')
  async getArchivedAlbums(@Req() req) {
    const albums = await this.albumsService.findArchivedAlbums(req.user.sub);

    return ApiResponse.success(
      'Archived albums fetched successfully',
      { albums },
    );
  }

  @Patch(':albumId')
  async updateAlbum(
    @Param('albumId') albumId: string,
    @Body() body: UpdateAlbumDto,
    @Req() req: any,
  ) {
    const album = await this.albumsService.updateDetails(albumId, req.user.sub, body);
    return ApiResponse.success('Album updated', { album });
  }

  // Upload a cover image from the client (local file). Client uploads to S3 using this presigned URL.
  @Get(':albumId/cover/presigned-url')
  async getCoverPresignedUrl(
    @Param('albumId') albumId: string,
    @Query('contentType') contentType: string,
    @Req() req: any,
  ) {
    if (!albumId || !contentType) {
      throw new BadRequestException('albumId and contentType are required');
    }

    await this.albumsService.assertAlbumOwnedByUser(albumId, req.user.sub);

    const extension = contentType.split('/')[1];
    const { v4: uuid } = await import('uuid');
    const key = `albums/${albumId}/cover/${uuid()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 60 * 5,
    });

    return ApiResponse.success('Presigned cover upload URL generated', { uploadUrl, key });
  }

  // After uploading to S3, save the cover key/url on the album
  @Patch(':albumId/cover')
  async setCover(@Param('albumId') albumId: string, @Body() body: UpdateAlbumCoverDto, @Req() req: any) {
    const album = await this.albumsService.setCoverImage(albumId, req.user.sub, body.coverImage);
    return ApiResponse.success('Album cover updated', { album });
  }

  // Request album visibility. Album will stay private while empty, but we store the intent.
  @Patch(':albumId/visibility')
  async setVisibility(
    @Param('albumId') albumId: string,
    @Body() body: UpdateAlbumVisibilityDto,
    @Req() req: any,
  ) {
    const album = await this.albumsService.requestVisibility(albumId, req.user.sub, body.isPublic);
    return ApiResponse.success('Album visibility updated', { album });
  }

  @Patch(':albumId/archive')
  async archiveAlbum(@Param('albumId') albumId: string, @Req() req: any) {
    const album = await this.albumsService.archiveAlbum(albumId, req.user.sub);
    return ApiResponse.success('Album archived (hidden from your list, still public)', { album });
  }

  @Patch(':albumId/restore')
  async restoreAlbum(@Param('albumId') albumId: string, @Req() req: any) {
    const album = await this.albumsService.restoreAlbum(albumId, req.user.sub);
    return ApiResponse.success('Album restored', { album });
  }

  @Delete(':albumId')
  async deleteAlbum(@Param('albumId') albumId: string, @Req() req: any) {
    await this.albumsService.deleteAlbum(albumId, req.user.sub);
    return ApiResponse.success('Album permanently deleted');
  }

  /**
   * Add album to favorites (Worth keeping).
   * User can favorite their own albums or any public album.
   */
  @Post(':albumId/favorite')
  async addFavorite(@Param('albumId') albumId: string, @Req() req: any) {
    const result = await this.albumsService.addFavorite(albumId, req.user.sub);
    return ApiResponse.success(result.message || 'Album added to favorites', { favorited: result.favorited });
  }

  /**
   * Remove album from favorites.
   */
  @Delete(':albumId/favorite')
  async removeFavorite(@Param('albumId') albumId: string, @Req() req: any) {
    const result = await this.albumsService.removeFavorite(albumId, req.user.sub);
    return ApiResponse.success(result.message || 'Album removed from favorites', { removed: result.removed });
  }

  /**
   * Get all favorite albums for the authenticated user.
   * Returns albums sorted by most recently favorited first.
   */
  @Get('favorites')
  async getFavorites(@Req() req: any) {
    const albums = await this.albumsService.getFavorites(req.user.sub);
    return ApiResponse.success('Favorite albums fetched successfully', { albums });
  }
}
