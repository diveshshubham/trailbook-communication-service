import { Injectable, Logger, Inject } from '@nestjs/common';
import type { Channel } from 'amqplib';
import { RABBITMQ_CHANNEL } from './rabbitmq.provider';

export interface FileUploadMessage {
  messageId: string;
  fileKey: string;
  fileName: string;
  contentType: string;
  size: number;
  senderId: string;
  receiverId: string;
}

export interface NotificationMessage {
  receiverId: string;
  senderId: string;
  messageId: string;
  content: string;
  hasFile: boolean;
  fileName?: string;
  fileType?: string;
}

@Injectable()
export class RabbitMQService {
  private readonly logger = new Logger(RabbitMQService.name);

  constructor(@Inject(RABBITMQ_CHANNEL) private readonly channel: Channel) {}

  /**
   * Publish file upload task to queue
   */
  async publishFileUpload(message: FileUploadMessage): Promise<boolean> {
    try {
      const queue = 'chat.file.upload';
      const messageBuffer = Buffer.from(JSON.stringify(message));

      const published = this.channel.sendToQueue(queue, messageBuffer, {
        persistent: true, // Message survives broker restarts
      });

      if (published) {
        this.logger.log(
          `Published file upload task: messageId=${message.messageId}, fileKey=${message.fileKey}`,
        );
        return true;
      } else {
        this.logger.warn(`Failed to publish file upload task: messageId=${message.messageId}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error publishing file upload task:`, error);
      throw error;
    }
  }

  /**
   * Publish notification task to queue
   */
  async publishNotification(message: NotificationMessage): Promise<boolean> {
    try {
      const queue = 'chat.notification.send';
      const messageBuffer = Buffer.from(JSON.stringify(message));

      const published = this.channel.sendToQueue(queue, messageBuffer, {
        persistent: true,
      });

      if (published) {
        this.logger.log(
          `Published notification task: receiverId=${message.receiverId}, messageId=${message.messageId}`,
        );
        return true;
      } else {
        this.logger.warn(
          `Failed to publish notification task: receiverId=${message.receiverId}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(`Error publishing notification task:`, error);
      throw error;
    }
  }
}
