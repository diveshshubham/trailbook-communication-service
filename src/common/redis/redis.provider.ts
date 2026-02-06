import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    redis.on('connect', () => {
      console.log('🟢 Redis connected');
    });

    redis.on('ready', () => {
      console.log('✅ Redis ready to use');
    });

    redis.on('error', (err) => {
      console.error('🔴 Redis error:', err.message);
    });

    redis.on('close', () => {
      console.warn('🟡 Redis connection closed');
    });

    return redis;
  },
};
