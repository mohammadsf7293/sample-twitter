import { Injectable, Inject } from '@nestjs/common';
import * as Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS') private readonly redis: Redis.Redis) {}

  async setValue(key: string, value: string): Promise<void> {
    await this.redis.set(key, value);
  }

  async getValue(key: string): Promise<string> {
    return await this.redis.get(key);
  }

  //Attention: just must be used for clearing test redis for running tests!
  async flushAll(): Promise<string> {
    return await this.redis.flushall();
  }
}
