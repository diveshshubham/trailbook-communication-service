import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { ConnectionRequestService } from './connection-request.service';
import { ApiResponse } from '../../utils/api-response';

@Controller('connection-requests')
@UseGuards(JwtAuthGuard)
export class ConnectionRequestController {
  constructor(
    private readonly connectionRequestService: ConnectionRequestService,
  ) {}

  /**
   * Send a connection request
   */
  @Post('send/:userId')
  async sendRequest(@Param('userId') recipientId: string, @Req() req: any) {
    const result = await this.connectionRequestService.sendRequest(
      req.user.sub,
      recipientId,
    );
    return ApiResponse.success('Connection request sent', result);
  }

  /**
   * Accept a connection request
   */
  @Put('accept/:requestId')
  async acceptRequest(@Param('requestId') requestId: string, @Req() req: any) {
    const result = await this.connectionRequestService.acceptRequest(
      req.user.sub,
      requestId,
    );
    return ApiResponse.success('Connection request accepted', result);
  }

  /**
   * Reject a connection request
   */
  @Put('reject/:requestId')
  async rejectRequest(@Param('requestId') requestId: string, @Req() req: any) {
    const result = await this.connectionRequestService.rejectRequest(
      req.user.sub,
      requestId,
    );
    return ApiResponse.success('Connection request rejected', result);
  }

  /**
   * Get all connected people
   */
  @Get('connected')
  async getConnectedPeople(@Req() req: any) {
    const connections = await this.connectionRequestService.getConnectedPeople(
      req.user.sub,
    );
    return ApiResponse.success('Connected people fetched', { connections });
  }

  /**
   * Get all rejected people
   */
  @Get('rejected')
  async getRejectedPeople(@Req() req: any) {
    const rejected = await this.connectionRequestService.getRejectedPeople(
      req.user.sub,
    );
    return ApiResponse.success('Rejected people fetched', { rejected });
  }

  /**
   * Get all pending requests
   */
  @Get('pending')
  async getPendingRequests(@Req() req: any) {
    const pending = await this.connectionRequestService.getPendingRequests(
      req.user.sub,
    );
    return ApiResponse.success('Pending requests fetched', { pending });
  }
}
