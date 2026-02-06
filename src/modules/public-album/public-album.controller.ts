import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { PublicAlbumService } from './public-album.service';
import { ApiResponse } from '../../utils/api-response';
import { InviteUserDto } from './dto/invite-user.dto';

@Controller('public-albums')
@UseGuards(JwtAuthGuard)
export class PublicAlbumController {
  constructor(private readonly publicAlbumService: PublicAlbumService) {}

  /**
   * Create a public album that allows contributors
   */
  @Post('create')
  async createPublicAlbum(
    @Body() body: { title: string; description?: string; allowContributors?: boolean },
    @Req() req: any,
  ) {
    const result = await this.publicAlbumService.createPublicAlbum(
      req.user.sub,
      body.title,
      body.description,
      body.allowContributors ?? true,
    );
    return ApiResponse.success('Public album created', result);
  }

  /**
   * Invite a user to contribute to a public album
   * Can invite by userId, email, or phone
   */
  @Post('invite')
  async inviteUser(@Body() inviteUserDto: InviteUserDto, @Req() req: any) {
    const result = await this.publicAlbumService.inviteUser(
      req.user.sub,
      inviteUserDto.albumId,
      inviteUserDto.userId,
      inviteUserDto.email,
      inviteUserDto.phone,
      inviteUserDto.permission,
      inviteUserDto.autoConnect,
    );
    return ApiResponse.success('User invited successfully', result);
  }

  /**
   * Accept an album invitation
   */
  @Put('invitations/:invitationId/accept')
  async acceptInvitation(
    @Param('invitationId') invitationId: string,
    @Req() req: any,
  ) {
    const result = await this.publicAlbumService.acceptInvitation(
      req.user.sub,
      invitationId,
    );
    return ApiResponse.success('Invitation accepted', result);
  }

  /**
   * Reject an album invitation
   */
  @Put('invitations/:invitationId/reject')
  async rejectInvitation(
    @Param('invitationId') invitationId: string,
    @Req() req: any,
  ) {
    const result = await this.publicAlbumService.rejectInvitation(
      req.user.sub,
      invitationId,
    );
    return ApiResponse.success('Invitation rejected', result);
  }

  /**
   * Get all invitations for current user
   */
  @Get('invitations/my')
  async getMyInvitations(@Req() req: any) {
    const invitations = await this.publicAlbumService.getMyInvitations(
      req.user.sub,
    );
    return ApiResponse.success('Invitations fetched', { invitations });
  }

  /**
   * Get all contributors for an album
   */
  @Get(':albumId/contributors')
  async getAlbumContributors(
    @Param('albumId') albumId: string,
    @Req() req: any,
  ) {
    const contributors = await this.publicAlbumService.getAlbumContributors(
      albumId,
      req.user.sub,
    );
    return ApiResponse.success('Contributors fetched', { contributors });
  }

  /**
   * Remove a contributor from an album
   */
  @Delete(':albumId/contributors/:contributorId')
  async removeContributor(
    @Param('albumId') albumId: string,
    @Param('contributorId') contributorId: string,
    @Req() req: any,
  ) {
    const result = await this.publicAlbumService.removeContributor(
      req.user.sub,
      albumId,
      contributorId,
    );
    return ApiResponse.success('Contributor removed', result);
  }

  /**
   * Get activity feed for an album
   */
  @Get(':albumId/activity')
  async getAlbumActivity(
    @Param('albumId') albumId: string,
    @Req() req: any,
  ) {
    const activities = await this.publicAlbumService.getAlbumActivity(
      albumId,
      req.user.sub,
    );
    return ApiResponse.success('Activity feed fetched', { activities });
  }

  /**
   * Get album analytics
   */
  @Get(':albumId/analytics')
  async getAlbumAnalytics(
    @Param('albumId') albumId: string,
    @Req() req: any,
  ) {
    const analytics = await this.publicAlbumService.getAlbumAnalytics(
      albumId,
      req.user.sub,
    );
    return ApiResponse.success('Analytics fetched', analytics);
  }
}
