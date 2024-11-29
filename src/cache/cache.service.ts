import { Injectable, Inject } from '@nestjs/common';
import * as Redis from 'ioredis';
import { CacheKeys } from './constants/cache-keys.constants';

@Injectable()
export class CacheService {
  constructor(@Inject('REDIS') private readonly redis: Redis.Redis) {}

  async setValue(key: string, value: string): Promise<void> {
    await this.redis.set(key, value);
  }

  async getValue(key: string): Promise<string> {
    return await this.redis.get(key);
  }

  /**
   * Add a public tweet to a ZSET with its creation timestamp as the score.
   * @param tweetId - The ID of the tweet.
   * @param hashtags - An array of hashtags associated with the tweet.
   * @param category - category of the tweet.
   * @param creationTimestamp - The timestamp when the tweet was created.
   */
  async addPublicTweetToZSet(
    tweetId: string,
    hashtags: string[],
    category: string,
    creationTimestamp: number,
  ): Promise<void> {
    const memberItem = `${tweetId}_${hashtags.join('_')}_${category}`;
    try {
      await this.redis.zadd(
        CacheKeys.PUBLIC_TWEETS_ZSET,
        creationTimestamp,
        memberItem,
      );
    } catch (error) {
      // Log or handle the error as necessary
      console.error('Error adding tweet to ZSET:', error);
      //TODO: there must be an error management, defining logical and internal errors
      throw new Error('Could not add public tweet to ZSET');
    }
  }
}
