import { Injectable, Inject } from '@nestjs/common';
import * as Redis from 'ioredis';
import { CacheKeys, CacheKeysTTLs } from './constants/cache.constants';

@Injectable()
export class CacheService {
  constructor(@Inject('REDIS') private readonly redis: Redis.Redis) {}

  // ttl is number of seconds which key will exist
  async setValue(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.set(key, value, 'EX', ttl);
    } else {
      await this.redis.set(key, value);
    }
  }

  async getValue(key: string): Promise<string> {
    return await this.redis.get(key);
  }

  /**
   * Add a public viewable tweet to a ZSET with its creation timestamp as the score.
   * @param tweetId - The ID of the tweet.
   * @param hashtags - An array of hashtags associated with the tweet.
   * @param category - category of the tweet.
   * @param creationTimestamp - The timestamp when the tweet was created.
   */
  async addPublicViewableTweetToZSet(
    tweetId: string,
    hashtags: string[],
    category: string,
    creationTimestamp: number,
  ): Promise<void> {
    const memberItem = `${tweetId}_${hashtags.join('_')}_${category}`;
    try {
      await this.redis.zadd(
        CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
        creationTimestamp,
        memberItem,
      );

      await this.redis.expire(
        CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
        CacheKeysTTLs.PUBLIC_VIEWABLE_TWEETS_ZSET,
      );
    } catch (error) {
      // Log or handle the error as necessary
      console.error('Error adding tweet to ZSET:', error);
      //TODO: there must be an error management, defining logical and internal errors
      throw new Error('Could not add public tweet to ZSET');
    }
  }

  /**
   * Add a private viewable tweet to a ZSET with its creation timestamp as the score.
   * @param groupId - The ID of the group the tweet belongs to.
   * @param tweetId - The ID of the tweet.
   * @param hashtags - An array of hashtags associated with the tweet.
   * @param category - category of the tweet.
   * @param creationTimestamp - The timestamp when the tweet was created.
   */
  async addPrivateViewableTweetToZSet(
    groupId: number,
    tweetId: string,
    hashtags: string[],
    category: string,
    creationTimestamp: number,
  ): Promise<void> {
    const memberItem = `${tweetId}_${hashtags.join('_')}_${category}`;
    try {
      const key = `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`;
      await this.redis.zadd(key, creationTimestamp, memberItem);

      await this.redis.expire(
        key,
        CacheKeysTTLs.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET,
      );
    } catch (error) {
      // Log or handle the error as necessary
      console.error('Error adding tweet to ZSET:', error);
      //TODO: there must be an error management, defining logical and internal errors
      throw new Error('Could not add public tweet to ZSET');
    }
  }

  async setTweetIsPublicEditable(tweetId: string): Promise<void> {
    const key = CacheKeys.PUBLIC_EDITABLE_TWEET_PREFIX + `${tweetId}`;
    const ttl = CacheKeysTTLs.PUBLIC_EDITABLE_TWEET;
    await this.setValue(key, '1', ttl);
  }

  async getTweetIsPublicEditable(tweetId: string): Promise<string> {
    const key = CacheKeys.PUBLIC_EDITABLE_TWEET_PREFIX + `${tweetId}`;
    return this.getValue(key);
  }
}
