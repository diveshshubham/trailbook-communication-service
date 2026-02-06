import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { Channel } from 'amqplib';

export const RABBITMQ_CONNECTION = 'RABBITMQ_CONNECTION';
export const RABBITMQ_CHANNEL = 'RABBITMQ_CHANNEL';

type RabbitMQConnection = Awaited<ReturnType<typeof amqp.connect>>;

@Injectable()
export class RabbitMQProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQProvider.name);
  private connection: RabbitMQConnection | null = null;
  private channel: Channel | null = null;
  private connectionPromise: Promise<void> | null = null;

  async onModuleInit() {
    // Start connection immediately
    this.connectionPromise = this.connect();
    await this.connectionPromise;
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Wait for connection to be ready (used by providers)
   */
  async waitForConnection(): Promise<void> {
    if (this.connectionPromise) {
      await this.connectionPromise;
    } else {
      // If not started yet, start it now
      this.connectionPromise = this.connect();
      await this.connectionPromise;
    }
  }

  private async connect() {
    try {
      const rabbitmqUrl =
        process.env.RABBITMQ_URL ||
        `amqp://${process.env.RABBITMQ_USERNAME || 'guest'}:${process.env.RABBITMQ_PASSWORD || 'guest'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || '5672'}`;

      this.logger.log(`Connecting to RabbitMQ: ${rabbitmqUrl.replace(/:[^:@]+@/, ':****@')}`);

      this.connection = await amqp.connect(rabbitmqUrl);
      if (!this.connection) {
        throw new Error('Failed to establish RabbitMQ connection');
      }
      this.channel = await this.connection.createChannel();
      if (!this.channel) {
        throw new Error('Failed to create RabbitMQ channel');
      }

      // Declare queues
      await this.setupQueues();

      this.logger.log('✅ RabbitMQ connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  private async setupQueues() {
    if (!this.channel) return;

    // Queue for file uploads
    await this.channel.assertQueue('chat.file.upload', {
      durable: true, // Survive broker restarts
    });

    // Queue for notifications
    await this.channel.assertQueue('chat.notification.send', {
      durable: true,
    });

    // Dead letter queues for failed messages
    await this.channel.assertQueue('chat.file.upload.dlq', {
      durable: true,
    });

    await this.channel.assertQueue('chat.notification.send.dlq', {
      durable: true,
    });

    this.logger.log('✅ RabbitMQ queues declared');
  }

  async disconnect() {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.logger.log('RabbitMQ disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting RabbitMQ:', error);
    }
  }

  getChannel(): Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    return this.channel;
  }

  getConnection(): RabbitMQConnection {
    if (!this.connection) {
      throw new Error('RabbitMQ connection not initialized');
    }
    return this.connection;
  }
}

export const RabbitMQConnectionProvider = {
  provide: RABBITMQ_CONNECTION,
  useFactory: async (provider: RabbitMQProvider) => {
    // Wait for connection to be ready
    await provider.waitForConnection();
    return provider.getConnection();
  },
  inject: [RabbitMQProvider],
};

export const RabbitMQChannelProvider = {
  provide: RABBITMQ_CHANNEL,
  useFactory: async (provider: RabbitMQProvider) => {
    // Wait for connection to be ready
    await provider.waitForConnection();
    return provider.getChannel();
  },
  inject: [RabbitMQProvider],
};
