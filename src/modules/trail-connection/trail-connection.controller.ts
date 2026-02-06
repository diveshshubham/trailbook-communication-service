import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { TrailConnectionService } from './trail-connection.service';
import { ApiResponse } from '../../utils/api-response';

@Controller('trail-connections')
@UseGuards(JwtAuthGuard)
export class TrailConnectionController {
  constructor(
    private readonly trailConnectionService: TrailConnectionService,
  ) {}

  /**
   * Check if current user is eligible to connect with another user
   */
  @Get('check-eligibility/:userId')
  async checkEligibility(
    @Param('userId') targetUserId: string,
    @Req() req: any,
  ) {
    const eligibility = await this.trailConnectionService.checkConnectionEligibility(
      req.user.sub,
      targetUserId,
    );
    return ApiResponse.success('Eligibility checked', eligibility);
  }

  /**
   * Create connection (Add to "Walked Together")
   */
  @Post('connect/:userId')
  async createConnection(
    @Param('userId') targetUserId: string,
    @Req() req: any,
  ) {
    const result = await this.trailConnectionService.createConnection(
      req.user.sub,
      targetUserId,
    );
    return ApiResponse.success('Connection created', result);
  }

  /**
   * Get all connections (Walked Together list)
   */
  @Get('walked-together')
  async getConnections(@Req() req: any) {
    const connections = await this.trailConnectionService.getConnections(
      req.user.sub,
    );
    return ApiResponse.success('Connections fetched', { connections });
  }

  /**
   * Get connection details with a specific user
   */
  @Get('with/:userId')
  async getConnectionDetails(
    @Param('userId') targetUserId: string,
    @Req() req: any,
  ) {
    const details = await this.trailConnectionService.getConnectionDetails(
      req.user.sub,
      targetUserId,
    );
    return ApiResponse.success('Connection details fetched', details);
  }

  /**
   * Remove connection
   */
  @Delete('with/:userId')
  async removeConnection(
    @Param('userId') targetUserId: string,
    @Req() req: any,
  ) {
    const result = await this.trailConnectionService.removeConnection(
      req.user.sub,
      targetUserId,
    );
    return ApiResponse.success('Connection removed', result);
  }
}
