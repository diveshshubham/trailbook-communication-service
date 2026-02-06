import { Controller, Get, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import Redis from 'ioredis';

import { REDIS_CLIENT } from './common/redis/redis.provider';
import { ApiResponse } from './utils/api-response';

@Controller()
export class AppController {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('/health')
  async healthCheck() {
    const mongoReadyState = this.mongoConnection.readyState;

    let redisConnected = false;
    try {
      const pong = await this.redis.ping();
      redisConnected = pong === 'PONG';
    } catch {
      redisConnected = false;
    }

    return ApiResponse.success('Health check OK', {
      status: 'ok',
      timestamp: new Date().toISOString(),
      mongo: {
        connected: mongoReadyState === 1,
        readyState: mongoReadyState,
      },
      redis: {
        connected: redisConnected,
      },
    });
  }
}
