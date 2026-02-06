import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import type { Channel } from 'amqplib';
import { ConsumeMessage } from 'amqplib';
import { RABBITMQ_CHANNEL } from '../../../common/rabbitmq/rabbitmq.provider';
import type { NotificationMessage } from '../../../common/rabbitmq/rabbitmq.service';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { UserProfile, type UserProfileDocument } from '../../../models/user-profile.schema';

@Injectable()
export class NotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumer.name);
  private readonly queue = 'chat.notification.send';
  private readonly maxRetries = 3;

  constructor(
    @Inject(RABBITMQ_CHANNEL) private readonly channel: Channel,
    @InjectModel(UserProfile.name) private readonly userProfileModel: Model<UserProfileDocument>,
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
            this.logger.error(`Error processing notification message:`, error);
            
            // Check retry count
            const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) as number;
            
            if (retryCount < this.maxRetries) {
              // Retry with exponential backoff
              const retryDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
              this.logger.log(`Retrying notification (attempt ${retryCount + 1}/${this.maxRetries}) after ${retryDelay}ms`);
              
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
              this.channel.sendToQueue('chat.notification.send.dlq', msg.content, {
                persistent: true,
              });
              this.channel.ack(msg);
            }
          }
        },
        { noAck: false },
      );

      this.logger.log(`✅ Notification consumer started on queue: ${this.queue}`);
    } catch (error) {
      this.logger.error(`Failed to start notification consumer:`, error);
      throw error;
    }
  }

  private async processMessage(msg: ConsumeMessage) {
    const messageData: NotificationMessage = JSON.parse(msg.content.toString());
    const { receiverId, senderId, messageId, content, hasFile, fileName, fileType } = messageData;

    this.logger.log(
      `Processing notification: receiverId=${receiverId}, senderId=${senderId}, messageId=${messageId}`,
    );

    // Get receiver's FCM token from user profile
    const receiverProfile = await this.userProfileModel.findOne({ userId: receiverId });
    
    if (!receiverProfile) {
      this.logger.warn(`User profile not found for receiverId: ${receiverId}`);
      return;
    }

    // Check if user has FCM token
    // TODO: Add fcmToken field to UserProfile schema if not exists
    const fcmToken = (receiverProfile as any).fcmToken;
    
    if (!fcmToken) {
      this.logger.log(`No FCM token found for receiverId: ${receiverId}, skipping notification`);
      return;
    }

    // Get sender's name for notification
    const senderProfile = await this.userProfileModel.findOne({ userId: senderId });
    const senderName = senderProfile?.fullName || 'Someone';

    // Prepare notification payload
    const notificationTitle = senderName;
    let notificationBody = content;
    
    if (hasFile) {
      if (fileType?.startsWith('image/')) {
        notificationBody = '📷 Sent a photo';
      } else if (fileType === 'application/pdf') {
        notificationBody = '📄 Sent a PDF';
      } else if (fileType?.startsWith('text/')) {
        notificationBody = '📝 Sent a text file';
      } else {
        notificationBody = `📎 Sent ${fileName || 'a file'}`;
      }
    }

    // Send Firebase Cloud Messaging notification
    // TODO: Implement Firebase Admin SDK integration
    // For now, this is a placeholder
    try {
      await this.sendFirebaseNotification(fcmToken, notificationTitle, notificationBody, {
        messageId,
        senderId,
        receiverId,
        hasFile,
        fileType,
      });

      this.logger.log(`✅ Notification sent successfully: receiverId=${receiverId}, messageId=${messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send Firebase notification:`, error);
      throw error;
    }
  }

  /**
   * Send Firebase Cloud Messaging notification
   * TODO: Implement with Firebase Admin SDK when credentials are ready
   */
  private async sendFirebaseNotification(
    fcmToken: string,
    title: string,
    body: string,
    data: Record<string, any>,
  ): Promise<void> {
    // Placeholder for Firebase implementation
    // When Firebase credentials are ready, implement like this:
    /*
    const admin = require('firebase-admin');
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }

    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
      },
      android: {
        priority: 'high',
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
      },
    });
    */

    this.logger.log(
      `[PLACEHOLDER] Would send FCM notification to token=${fcmToken.substring(0, 10)}..., title=${title}, body=${body}`,
    );
    
    // For now, just log - will be implemented when Firebase credentials are ready
    // Uncomment the code above and remove this placeholder when ready
  }
}
