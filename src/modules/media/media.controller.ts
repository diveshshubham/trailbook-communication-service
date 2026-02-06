import {
    Body,
    BadRequestException,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
    Query
} from '@nestjs/common';

import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject } from '@nestjs/common';
import { S3_CLIENT } from '../../common/s3/s3.provider';
import { UpdateMediaTagsDto } from './dto/update-media-tags.dto';
import { UpdateMediaDetailsDto } from './dto/update-media-details.dto';
import { CreatePresignedUrlsDto } from './dto/create-presigned-urls.dto';
import { DeleteS3ObjectDto } from './dto/delete-s3-object.dto';
import { ApiResponse } from '../../utils/api-response';
import { Types } from 'mongoose';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
    constructor(
        @Inject(S3_CLIENT) private readonly s3: S3Client,
        private readonly mediaService: MediaService
    ) { }

    @Post('presigned-urls')
    async getPresignedUrlsBatch(
        @Body() body: CreatePresignedUrlsDto,
        @Req() req: any,
    ) {
        const albumId = body.albumId;
        const files = body.files ?? [];

        if (!albumId || !Types.ObjectId.isValid(albumId)) {
            throw new BadRequestException('Valid albumId is required');
        }

        // single DB check for the whole batch
        await this.mediaService.assertAlbumOwnedByUser(albumId, req.user.sub);

        const { v4: uuid } = await import('uuid');

        const expiresIn = Math.min(Math.max(Number(body.expiresInSeconds ?? 300), 60), 60 * 10); // 1–10 min

        const uploads = await Promise.all(
            files.map(async (file) => {
                const contentType = file.contentType;
                const subtype = (contentType.split('/')[1] || '').toLowerCase();
                const extension =
                    subtype === 'jpeg' ? 'jpg'
                        : subtype === 'png' ? 'png'
                            : subtype === 'webp' ? 'webp'
                                : subtype === 'heic' ? 'heic'
                                    : subtype === 'heif' ? 'heif'
                                        : 'bin';

                const key = `albums/${albumId}/${uuid()}.${extension}`;

                const command = new PutObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET!,
                    Key: key,
                    ContentType: contentType,
                });

                const uploadUrl = await getSignedUrl(this.s3, command, {
                    expiresIn,
                });

                return { key, uploadUrl, contentType };
            })
        );

        return ApiResponse.success('Presigned upload URLs generated', {
            albumId,
            expiresInSeconds: expiresIn,
            uploads,
        });
    }

    @Get('presigned-url')
    async getPresignedUrl(
        @Query('albumId') albumId: string,
        @Query('contentType') contentType: string,
        @Req() req: any,
    ) {
        if (!contentType) {
            throw new BadRequestException('contentType is required');
        }

        const extension = contentType.split('/')[1];
        const { v4: uuid } = await import('uuid');

        // If albumId is a real Mongo ObjectId, enforce ownership and upload into that album folder.
        // If albumId is missing/temporary (e.g. during album creation before we have a DB id),
        // allow a draft upload under the current user.
        let key: string;
        if (albumId && Types.ObjectId.isValid(albumId)) {
            await this.mediaService.assertAlbumOwnedByUser(albumId, req.user.sub);
            key = `albums/${albumId}/${uuid()}.${extension}`;
        } else {
            key = `albums/drafts/${req.user.sub}/cover/${uuid()}.${extension}`;
        }

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: key,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(this.s3, command, {
            expiresIn: 60 * 5, // 5 minutes
        });

        return ApiResponse.success('Presigned upload URL generated', { uploadUrl, key });
    }

    @Post()
    async saveMedia(@Body() body: any, @Req() req: any) {
        const { albumId, key, contentType, size, title, description, location, story, tags, isPublic } = body;

        if (!albumId || !key || !contentType) {
            throw new BadRequestException('albumId, key and contentType are required');
        }

        if (typeof tags !== 'undefined' && !Array.isArray(tags)) {
            throw new BadRequestException('tags must be an array of strings');
        }

        if (typeof isPublic !== 'undefined' && typeof isPublic !== 'boolean') {
            throw new BadRequestException('isPublic must be a boolean');
        }

        const media = await this.mediaService.create({
            albumId,
            key,
            contentType,
            size,
            userId: req.user.sub,
            title,
            description,
            location,
            story,
            tags,
            isPublic,
        });

        return ApiResponse.success('Media saved', { media });
    }

    @Get('album/:albumId')
    async getAlbumMedia(@Param('albumId') albumId: string, @Req() req: any) {
        const media = await this.mediaService.findByAlbum(albumId, req.user.sub);
        return ApiResponse.success('Album media fetched', { media });
    }

    @Get('album/:albumId/archived')
    async getArchivedAlbumMedia(@Param('albumId') albumId: string, @Req() req: any) {
        const { media, album } = await this.mediaService.findArchivedByAlbum(albumId, req.user.sub);
        return ApiResponse.success('Archived album media fetched', { media, album });
    }

    @Get('archived')
    async getAllArchivedMedia(@Req() req: any) {
        const media = await this.mediaService.findAllArchivedMedia(req.user.sub);
        return ApiResponse.success('All archived media fetched', { media });
    }

    @Delete('s3-object')
    async deleteS3Object(@Body() body: DeleteS3ObjectDto, @Req() req: any) {
        await this.mediaService.deleteS3ObjectByKey(body.albumId, body.key, req.user.sub);
        return ApiResponse.success('S3 object deleted');
    }

    @Patch(':mediaId/archive')
    async archiveMedia(@Param('mediaId') mediaId: string, @Req() req: any) {
        const media = await this.mediaService.archiveMedia(mediaId, req.user.sub);
        return ApiResponse.success('Media archived (hidden from album)', { media });
    }

    @Patch(':mediaId/restore')
    async restoreMedia(@Param('mediaId') mediaId: string, @Req() req: any) {
        const media = await this.mediaService.restoreMedia(mediaId, req.user.sub);
        return ApiResponse.success('Media restored', { media });
    }

    @Delete(':mediaId')
    async deleteMedia(@Param('mediaId') mediaId: string, @Req() req: any) {
        await this.mediaService.deleteMedia(mediaId, req.user.sub);
        return ApiResponse.success('Media permanently deleted');
    }

    @Patch(':mediaId/tags')
    async updateMediaTags(
        @Param('mediaId') mediaId: string,
        @Body() body: UpdateMediaTagsDto,
        @Req() req: any,
    ) {
        // allow partial update; default to empty array only if explicitly passed
        if (!body || !Array.isArray(body.tags)) {
            throw new BadRequestException('tags must be an array of strings');
        }

        const media = await this.mediaService.updateTags(mediaId, req.user.sub, body.tags);
        return ApiResponse.success('Media tags updated', { media });
    }

    @Patch(':mediaId/details')
    async updateMediaDetails(
        @Param('mediaId') mediaId: string,
        @Body() body: UpdateMediaDetailsDto,
        @Req() req: any,
    ) {
        const media = await this.mediaService.updateDetails(mediaId, req.user.sub, body ?? {});
        return ApiResponse.success('Media details updated', { media });
    }

    // Set this media as the album cover (album.coverImage = media.key)
    @Patch(':mediaId/make-cover')
    async makeMediaAlbumCover(
        @Param('mediaId') mediaId: string,
        @Req() req: any,
    ) {
        const album = await this.mediaService.setAsAlbumCover(mediaId, req.user.sub);
        return ApiResponse.success('Album cover updated from media', { album });
    }

}
