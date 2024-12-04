import { Injectable, Inject } from '@nestjs/common';
import * as Redis from 'ioredis';
import {
  CacheKeys,
  CacheKeysTTLs,
  TweetAtrrsJoinInfix,
} from './constants/cache.constants';

export type TweetKey = {
  id: string;
  authorId: number;
  parentTweetId: string | null;
  hashtags: string[];
  creationTimeStamp: number;
  category: string;
  location: string;
};

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
   * Add a an item with a specific score to redis sorted sets (ZSET).
   * @param key - The key of set.
   * @param item - The string item (which has a score) to be added to sorted set.
   * @param score - score of item.
   * @param ttl - expiration time of the given key in seconds.
   */
  async addItemToZset(
    key: string,
    item: string,
    score: number,
    ttl: number,
  ): Promise<void> {
    try {
      await this.redis.zadd(key, score, item);

      await this.redis.expire(key, ttl);
    } catch (error) {
      // Log or handle the error as necessary
      console.error('Error adding tweet to ZSET:', error);
      //TODO: there must be an error management, defining logical and internal errors
      throw new Error('Could not add public tweet to ZSET');
    }
  }

  /**
   * Paginates item from a specific sorted set (Zset).
   * @param key - The key of set.
   * @param scoreFrom - The score from which items should be paginated.
   * @param scoreTo - The score from which items should be paginated.
   * @param offset - offset from which items should be listed
   * @param offset - limit of items to be listed
   */
  async paginateZset(
    key: string,
    scoreFrom: number,
    scoreTo: number,
    offset: number,
    limit: number,
  ): Promise<{ score: number; item: string }[]> {
    try {
      const members = await this.redis.zrevrangebyscore(
        key,
        scoreTo,
        scoreFrom,
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
          score: parseFloat(members[i + 1]),
        });
      }

      return results;
    } catch (error) {
      console.error('Error fetching items from zset:', error);
      throw new Error('Could not find items from Zset');
    }
  }

  async parsePaginateZsetResults(
    zsetResults: { item: string; score: number }[], // Receive the array directly
  ): Promise<TweetKey[]> {
    return zsetResults.map(({ score, item }) => {
      const [id, authorId, hashtagsString, category, location, parentTweetId] =
        item.split(TweetAtrrsJoinInfix);
      const hashtags = hashtagsString ? hashtagsString.split('_') : [];
      return {
        id,
        authorId: parseInt(authorId, 10),
        parentTweetId: parentTweetId === '-1' ? null : parentTweetId,
        hashtags: hashtags,
        creationTimeStamp: score,
        category: category,
        location: location,
      };
    });
  }

  /**
   * Add a public viewable tweet to a redis sorted set with its key attributes as the key and its timestamp as the score.
   * @param tweetId - The ID of the tweet.
   * @param authorId - The ID of the author of the tweet.
   * @param hashtags - An array of hashtags associated with the tweet.
   * @param category - category of the tweet.
   * @param location - location of the author of the tweet.
   * @param creationTimestamp - The timestamp when the tweet was created.
   * @param parentTweetId - ID of parent of the tweet.
   */
  async addUserCreatedTweetToZSet(
    tweetId: string,
    authorId: number,
    hashtags: string[],
    category: string,
    location: string,
    creationTimestamp: number,
    parentTweetId?: string,
  ): Promise<void> {
    const infix = TweetAtrrsJoinInfix;
    const parentTweetIdStr = parentTweetId ? parentTweetId.toString() : '-1';
    const memberItem = `${tweetId}${infix}${authorId.toString()}${infix}${hashtags.join('_')}${infix}${category}${infix}${location}${infix}${parentTweetIdStr}`;
    const key = `${CacheKeys.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET_PREFIX}${authorId}`;
    const ttl = CacheKeysTTLs.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET;

    return this.addItemToZset(key, memberItem, creationTimestamp, ttl);
  }

  async paginateUserCreatedTweetIds(
    userId: number,
    creationTimestampFrom: number,
    creationTimestampTo: number,
    offset: number,
    limit: number,
  ): Promise<TweetKey[]> {
    const key = `${CacheKeys.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET_PREFIX}${userId}`;
    const results = await this.paginateZset(
      key,
      creationTimestampFrom,
      creationTimestampTo,
      offset,
      limit,
    );

    return this.parsePaginateZsetResults(results);
  }

  /**
   * Add a public viewable tweet to a redis sorted set with its key attributes as the key and its timestamp as the score.
   * @param tweetId - The ID of the tweet.
   * @param authorId - The ID of the author of the tweet.
   * @param hashtags - An array of hashtags associated with the tweet.
   * @param category - category of the tweet.
   * @param location - location of the author of the tweet.
   * @param creationTimestamp - The timestamp when the tweet was created.
   * @param parentTweetId - ID of parent of the tweet.
   */
  async addPublicViewableTweetToZSet(
    tweetId: string,
    authorId: number,
    hashtags: string[],
    category: string,
    location: string,
    creationTimestamp: number,
    parentTweetId?: string,
  ): Promise<void> {
    const infix = TweetAtrrsJoinInfix;
    const parentTweetIdStr = parentTweetId ? parentTweetId.toString() : '-1';
    const memberItem = `${tweetId}${infix}${authorId.toString()}${infix}${hashtags.join('_')}${infix}${category}${infix}${location}${infix}${parentTweetIdStr}`;
    return this.addItemToZset(
      CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
      memberItem,
      creationTimestamp,
      CacheKeysTTLs.PUBLIC_VIEWABLE_TWEETS_ZSET,
    );
  }

  async paginatePublicTweetIds(
    creationTimestampFrom: number,
    creationTimestampTo: number,
    offset: number,
    limit: number,
  ): Promise<TweetKey[]> {
    const key = CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET;
    const results = await this.paginateZset(
      key,
      creationTimestampFrom,
      creationTimestampTo,
      offset,
      limit,
    );

    return this.parsePaginateZsetResults(results);
  }

  /**
   * Add a private viewable tweet to a ZSET with its creation timestamp as the score.
   * @param groupId - The ID of the group the tweet belongs to.
   * @param tweetId - The ID of the tweet.
   * @param authorId - The ID of the author of the tweet.
   * @param hashtags - An array of hashtags associated with the tweet.
   * @param category - category of the tweet.
   * @param location - location of the author of the tweet.
   * @param creationTimestamp - The timestamp when the tweet was created.
   * @param parentTweetId - ID of parent of the tweet.
   */
  async addPrivateViewableTweetToZSet(
    groupId: number,
    tweetId: string,
    authorId: number,
    hashtags: string[],
    category: string,
    location: string,
    creationTimestamp: number,
    parentTweetId?: string,
  ): Promise<void> {
    const infix = TweetAtrrsJoinInfix;
    const parentTweetIdStr = parentTweetId ? parentTweetId.toString() : '-1';
    const memberItem = `${tweetId}${infix}${authorId.toString()}${infix}${hashtags.join('_')}${infix}${category}${infix}${location}${infix}${parentTweetIdStr}`;
    const key = `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`;
    const ttl = CacheKeysTTLs.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET;

    return this.addItemToZset(key, memberItem, creationTimestamp, ttl);
  }

  async paginatePrivateTweetIds(
    groupId: number,
    creationTimestampFrom: number,
    creationTimestampTo: number,
    offset: number,
    limit: number,
  ): Promise<TweetKey[]> {
    const key = `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`;
    const results = await this.paginateZset(
      key,
      creationTimestampFrom,
      creationTimestampTo,
      offset,
      limit,
    );

    return this.parsePaginateZsetResults(results);
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
