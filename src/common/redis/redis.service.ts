import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  async incr(key: string, ttl: number) {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttl);
    }
    return count;
  }

  async del(key: string) {
    return this.redis.del(key);
  }
}
