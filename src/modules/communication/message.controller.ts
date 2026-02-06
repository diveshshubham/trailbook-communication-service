import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { MessageService } from './message.service';
import { ApiResponse } from '../../utils/api-response';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  /**
   * Send a message
   */
  @Post('send')
  async sendMessage(@Body() sendMessageDto: SendMessageDto, @Req() req: any) {
    const result = await this.messageService.sendMessage(
      req.user.sub,
      sendMessageDto.receiverId,
      sendMessageDto.content,
    );
    return ApiResponse.success('Message sent', result);
  }

  /**
   * Get messages with a specific user (cursor-based pagination)
   * Query params:
   * - cursor: (optional) Message ID to start from
   * - limit: (optional, default: 50, max: 100) Number of messages to fetch
   * - direction: (optional, default: 'before') 'before' for older messages, 'after' for newer messages
   */
  @Get('with/:otherUserId')
  async getMessages(
    @Param('otherUserId') otherUserId: string,
    @Query() query: GetMessagesDto,
    @Req() req: any,
  ) {
    const result = await this.messageService.getMessages(
      req.user.sub,
      otherUserId,
      query.cursor,
      query.limit,
      query.direction,
    );
    return ApiResponse.success('Messages fetched', result);
  }

  /**
   * Get all conversations
   */
  @Get('conversations')
  async getConversations(@Req() req: any) {
    const conversations = await this.messageService.getConversations(
      req.user.sub,
    );
    return ApiResponse.success('Conversations fetched', { conversations });
  }

  /**
   * Get unread message count
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const result = await this.messageService.getUnreadCount(req.user.sub);
    return ApiResponse.success('Unread count fetched', result);
  }
}
