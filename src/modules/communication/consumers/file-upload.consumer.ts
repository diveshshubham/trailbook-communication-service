import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import type { Channel } from 'amqplib';
import { ConsumeMessage } from 'amqplib';
import { RABBITMQ_CHANNEL } from '../../../common/rabbitmq/rabbitmq.provider';
import type { FileUploadMessage } from '../../../common/rabbitmq/rabbitmq.service';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Message, type MessageDocument } from '../../../models/message.schema';
import type { S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT } from '../../../common/s3/s3.provider';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileUploadConsumer implements OnModuleInit {
  private readonly logger = new Logger(FileUploadConsumer.name);
  private readonly queue = 'chat.file.upload';
  private readonly maxRetries = 3;

  constructor(
    @Inject(RABBITMQ_CHANNEL) private readonly channel: Channel,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @Inject(S3_CLIENT) private readonly s3Client: S3Client,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.startConsuming();
  }

  private async startConsuming() {
    try {
      // Set prefetch to process one message at a time
      await this.channel.prefetch(1);

      await this.channel.consume(
        this.queue,
        async (msg: ConsumeMessage | null) => {
          if (!msg) return;

          try {
            await this.processMessage(msg);
            this.channel.ack(msg);
          } catch (error) {
            this.logger.error(`Error processing file upload message:`, error);
            
            // Check retry count
            const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) as number;
            
            if (retryCount < this.maxRetries) {
              // Retry with exponential backoff
              const retryDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
              this.logger.log(`Retrying message (attempt ${retryCount + 1}/${this.maxRetries}) after ${retryDelay}ms`);
              
              setTimeout(() => {
                this.channel.publish('', this.queue, msg.content, {
                  ...msg.properties,
                  headers: {
                    ...msg.properties.headers,
                    'x-retry-count': retryCount + 1,
                  },
                });
              }, retryDelay);
              
              this.channel.ack(msg);
            } else {
              // Move to dead letter queue
              this.logger.error(`Max retries reached, moving to DLQ: ${msg.content.toString()}`);
              this.channel.sendToQueue('chat.file.upload.dlq', msg.content, {
                persistent: true,
              });
              this.channel.ack(msg);
            }
          }
        },
        { noAck: false },
      );

      this.logger.log(`✅ File upload consumer started on queue: ${this.queue}`);
    } catch (error) {
      this.logger.error(`Failed to start file upload consumer:`, error);
      throw error;
    }
  }

  private async processMessage(msg: ConsumeMessage) {
    const messageData: FileUploadMessage = JSON.parse(msg.content.toString());
    const { messageId, fileKey, fileName, contentType, size } = messageData;

    this.logger.log(
      `Processing file upload: messageId=${messageId}, fileKey=${fileKey}, fileName=${fileName}`,
    );

    // Find the message
    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    // Check if file already uploaded
    if (message.isFileUploaded && message.fileUrl) {
      this.logger.log(`File already uploaded for message: ${messageId}`);
      return;
    }

    // Generate S3 URL for the file
    // Note: The file should already be uploaded to S3 by the client using presigned URL
    // We just need to generate a permanent URL or verify it exists
    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucket) {
      throw new Error('AWS_S3_BUCKET not configured');
    }

    // Generate a public URL (or signed URL if bucket is private)
    // For now, we'll use the S3 public URL format
    // You can adjust this based on your S3 bucket configuration
    const fileUrl = `https://${bucket}.s3.${this.configService.get<string>('AWS_REGION') || 'us-east-1'}.amazonaws.com/${fileKey}`;

    // Update message with file URL and mark as uploaded
    message.fileUrl = fileUrl;
    message.isFileUploaded = true;
    await message.save();

    this.logger.log(
      `✅ File upload completed: messageId=${messageId}, fileUrl=${fileUrl}`,
    );
  }
}
