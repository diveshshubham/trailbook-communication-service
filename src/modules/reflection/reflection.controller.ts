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
import { ReflectionService } from './reflection.service';
import { ReflectMediaDto } from './dto/reflect-media.dto';
import { ApiResponse } from '../../utils/api-response';

@Controller('reflections')
@UseGuards(JwtAuthGuard)
export class ReflectionController {
  constructor(private readonly reflectionService: ReflectionService) {}

  @Post('media/:mediaId')
  async reflectOnMedia(
    @Param('mediaId') mediaId: string,
    @Body() dto: ReflectMediaDto,
    @Req() req: any,
  ) {
    const result = await this.reflectionService.addReflection(
      mediaId,
      req.user.sub,
      dto.reason,
      dto.note,
      dto.isAnonymous || false,
    );
    return ApiResponse.success('Reflection added', result);
  }

  @Delete('media/:mediaId')
  async removeReflection(
    @Param('mediaId') mediaId: string,
    @Req() req: any,
  ) {
    const result = await this.reflectionService.removeReflection(
      mediaId,
      req.user.sub,
    );
    return ApiResponse.success('Reflection removed', result);
  }

  @Get('media/:mediaId')
  async getReflections(
    @Param('mediaId') mediaId: string,
    @Req() req: any,
  ) {
    const reflections = await this.reflectionService.getReflections(
      mediaId,
      req.user.sub,
    );
    return ApiResponse.success('Reflections fetched', { reflections });
  }
}
