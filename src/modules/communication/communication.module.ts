import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConnectionRequest, ConnectionRequestSchema } from '../../models/connection-request.schema';
import { Message, MessageSchema } from '../../models/message.schema';
import { UserProfile, UserProfileSchema } from '../../models/user-profile.schema';
import { ConnectionRequestService } from './connection-request.service';
import { ConnectionRequestController } from './connection-request.controller';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { ChatGateway } from './chat.gateway';
import { RabbitMQModule } from '../../common/rabbitmq/rabbitmq.module';
import { FileUploadConsumer } from './consumers/file-upload.consumer';
import { NotificationConsumer } from './consumers/notification.consumer';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConnectionRequest.name, schema: ConnectionRequestSchema },
      { name: Message.name, schema: MessageSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    RabbitMQModule,
  ],
  controllers: [ConnectionRequestController, MessageController],
  providers: [
    ConnectionRequestService,
    MessageService,
    ChatGateway,
    FileUploadConsumer,
    NotificationConsumer,
  ],
  exports: [ConnectionRequestService, MessageService],
})
export class CommunicationModule {}
