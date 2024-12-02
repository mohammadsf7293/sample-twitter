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
   * Stores a serialized tweet in Redis.
   *
   * @param tweetId - The ID of the tweet to be cached.
   * @param serializedTweetStr - The serialized tweet data in string format.
   */
  async cacheTweet(tweetId: string, serializedTweetStr: string): Promise<void> {
    try {
      const cacheKey = `${CacheKeys.CACHED_TWEET_PREFIX}${tweetId}`;
      await this.redis.set(
        cacheKey,
        serializedTweetStr,
        'EX',
        CacheKeysTTLs.CACHED_TWEET,
      );

      console.log(`Tweet ${tweetId} cached successfully.`);
    } catch (error) {
      console.error(`Failed to cache tweet ${tweetId}:`, error);
      throw new Error(`Could not cache tweet: ${error.message}`);
    }
  }

  /**
   * Retrieves a cached tweet from Redis.
   *
   * @param tweetId - The ID of the tweet to retrieve.
   * @returns The serialized tweet string from the cache.
   * @throws If the tweet is not found or there is a Redis error.
   */
  async getCachedTweet(tweetId: string): Promise<string> {
    try {
      const cacheKey = `${CacheKeys.CACHED_TWEET_PREFIX}${tweetId}`;
      const cachedTweet = await this.redis.get(cacheKey);

      if (!cachedTweet) {
        throw new Error(`Tweet with ID ${tweetId} not found in cache.`);
      }

      return cachedTweet;
    } catch (error) {
      console.error(`Failed to fetch cached tweet ${tweetId}:`, error);
      throw new Error(`Could not retrieve cached tweet: ${error.message}`);
    }
  }

  /**
   * Add a tweet to ZSET of their created tweets.
   * @param tweetId - The ID of the tweet.
   * @param hashtags - An array of hashtags associated with the tweet.
   * @param category - category of the tweet.
   * @param creationTimestamp - The timestamp when the tweet was created.
   */
  async addUserCreatedTweetToZSet(
    userId: number,
    tweetId: string,
    hashtags: string[],
    category: string,
    creationTimestamp: number,
  ): Promise<void> {
    const memberItem = `${tweetId}_${hashtags.join('_')}_${category}`;
    const key = `${CacheKeys.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET_PREFIX}${userId}`;
    try {
      await this.redis.zadd(key, creationTimestamp, memberItem);

      await this.redis.expire(
        key,
        CacheKeysTTLs.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET,
      );
    } catch (error) {
      // Log or handle the error as necessary
      console.error('Error adding tweet to ZSET:', error);
      //TODO: there must be an error management, defining logical and internal errors
      throw new Error('Could not add public tweet to ZSET');
    }
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

  async paginatePublicTweetIds(
    creationTimestampFrom: number,
    creationTimestampTo: number,
    offset: number,
    limit: number,
  ): Promise<{ score: number; item: string }[]> {
    try {
      const members = await this.redis.zrevrangebyscore(
        CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
        creationTimestampTo,
        creationTimestampFrom,
        'WITHSCORES',
        'LIMIT',
        offset,
        limit,
      );

      // Convert the flat array into an array of objects
      const results = [];
      for (let i = 0; i < members.length; i += 2) {
        results.push({
          item: members[i],
          score: parseFloat(members[i + 1]), // Convert the score from string to number
        });
      }

      return results;
    } catch (error) {
      console.error('Error fetching items from zset:', error);
      throw new Error('Could not find items from Zset');
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

  async paginatePrivateTweetIds(
    groupId: number,
    creationTimestampFrom: number,
    creationTimestampTo: number,
    offset: number,
    limit: number,
  ): Promise<{ score: number; item: string }[]> {
    try {
      const key = `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`;
      const members = await this.redis.zrevrangebyscore(
        key,
        creationTimestampTo,
        creationTimestampFrom,
        'WITHSCORES',
        'LIMIT',
        offset,
        limit,
      );

      // Convert the flat array into an array of objects
      const results = [];
      for (let i = 0; i < members.length; i += 2) {
        results.push({
          item: members[i],
          score: parseFloat(members[i + 1]), // Convert the score from string to number
        });
      }

      return results;
    } catch (error) {
      console.error('Error fetching items from zset:', error);
      throw new Error('Could not find items from Zset');
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

  async setTweetIsEditableByGroup(
    tweetId: string,
    groupId: number,
  ): Promise<void> {
    const key = `${CacheKeys.GROUP_EDITABLE_TWEET_PREFIX}${tweetId}:${groupId.toString()}`;
    const ttl = CacheKeysTTLs.GROUP_EDITABLE_TWEET;
    await this.setValue(key, '1', ttl);
  }

  async getTweetIsEditableByGroup(
    tweetId: string,
    groupId: number,
  ): Promise<string> {
    const key = `${CacheKeys.GROUP_EDITABLE_TWEET_PREFIX}${tweetId}:${groupId.toString()}`;
    return this.getValue(key);
  }
}
