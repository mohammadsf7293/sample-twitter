import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import {
  CacheKeys,
  CacheKeysTTLs,
  TweetAtrrsJoinInfix,
} from './constants/cache.constants';

describe('CacheService', () => {
  let service: CacheService;
  let mockRedisClient: {
    set: jest.Mock;
    get: jest.Mock;
    zadd: jest.Mock;
    zrevrangebyscore: jest.Mock;
    expire: jest.Mock;
  };

  beforeEach(async () => {
    // Create a mocked Redis client
    mockRedisClient = {
      set: jest.fn(),
      get: jest.fn(),
      zadd: jest.fn(),
      zrevrangebyscore: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: 'REDIS',
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  describe('setValue', () => {
    it('should set a value without TTL if no ttl is provided', async () => {
      // Arrange
      const key = 'testKey';
      const value = 'testValue';

      // Act
      await service.setValue(key, value);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    });

    it('should set a value with TTL if ttl is provided', async () => {
      // Arrange
      const key = 'testKeyWithTTL';
      const value = 'testValueWithTTL';
      const ttl = 3600; // 1 hour

      // Act
      await service.setValue(key, value, ttl);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value, 'EX', ttl);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    });

    it('should not set TTL if ttl is zero', async () => {
      // Arrange
      const key = 'testKeyWithZeroTTL';
      const value = 'testValueWithZeroTTL';
      const ttl = 0;

      // Act
      await service.setValue(key, value, ttl);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('getValue', () => {
    it('should return the value from Redis when key exists', async () => {
      // Arrange
      const key = 'existingKey';
      const value = 'someValue';
      mockRedisClient.get.mockResolvedValue(value); // Mock Redis to return the value

      // Act
      const result = await service.getValue(key);

      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(mockRedisClient.get).toHaveBeenCalledTimes(1);
      expect(result).toBe(value); // Verify that the result is the expected value
    });

    it('should return null when key does not exist in Redis', async () => {
      // Arrange
      const key = 'nonExistingKey';
      mockRedisClient.get.mockResolvedValue(null); // Mock Redis to return null

      // Act
      const result = await service.getValue(key);

      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(mockRedisClient.get).toHaveBeenCalledTimes(1);
      expect(result).toBeNull(); // Verify that the result is null (key doesn't exist)
    });

    it('should throw an error if Redis throws an exception', async () => {
      // Arrange
      const key = 'errorKey';
      const errorMessage = 'Redis error';
      mockRedisClient.get.mockRejectedValue(new Error(errorMessage)); // Mock Redis to throw an error

      // Act & Assert
      await expect(service.getValue(key)).rejects.toThrowError('Redis error');
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(mockRedisClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('cacheTweet', () => {
    const tweetId = '12345';
    const serializedTweetStr = '{"id":"12345","content":"Hello world"}';
    const cacheKey = `${CacheKeys.CACHED_TWEET_PREFIX}${tweetId}`;

    it('should cache the tweet successfully', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.cacheTweet(tweetId, serializedTweetStr);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        cacheKey,
        serializedTweetStr,
        'EX',
        expect.any(Number), // CacheKeysTTLs.CACHED_TWEET
      );
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if Redis fails', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.cacheTweet(tweetId, serializedTweetStr),
      ).rejects.toThrow('Could not cache tweet: Redis error');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        cacheKey,
        serializedTweetStr,
        'EX',
        expect.any(Number),
      );
    });

    it('should use the correct cache key format', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.cacheTweet(tweetId, serializedTweetStr);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        cacheKey,
        serializedTweetStr,
        'EX',
        expect.any(Number),
      );
    });

    it('should log success message when caching succeeds', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockRedisClient.set.mockResolvedValue('OK');

      await service.cacheTweet(tweetId, serializedTweetStr);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Tweet ${tweetId} cached successfully.`,
      );
      consoleLogSpy.mockRestore();
    });

    it('should log error message when caching fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.cacheTweet(tweetId, serializedTweetStr),
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to cache tweet ${tweetId}:`,
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getCachedTweet', () => {
    it('should return the cached tweet string if the tweet is found', async () => {
      const tweetId = '123';
      const cachedTweet = 'serialized-tweet-string';

      mockRedisClient.get.mockResolvedValue(cachedTweet);

      const result = await service.getCachedTweet(tweetId);

      expect(result).toBe(cachedTweet);
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `${CacheKeys.CACHED_TWEET_PREFIX}${tweetId}`,
      );
    });

    it('should throw an error if the tweet is not found in the cache', async () => {
      const tweetId = '123';
      const errorMessage = `Tweet with ID ${tweetId} not found in cache.`;

      // Mocking Redis GET failure (no cache)
      mockRedisClient.get.mockResolvedValue(null);

      await expect(service.getCachedTweet(tweetId)).rejects.toThrowError(
        errorMessage,
      );
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `${CacheKeys.CACHED_TWEET_PREFIX}${tweetId}`,
      );
    });

    it('should throw an error if there is a Redis error', async () => {
      const tweetId = '123';
      const redisError = new Error('Redis connection error');
      // Mocking Redis GET failure (error)
      mockRedisClient.get.mockRejectedValue(redisError);

      await expect(service.getCachedTweet(tweetId)).rejects.toThrowError(
        `Could not retrieve cached tweet: ${redisError.message}`,
      );
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `${CacheKeys.CACHED_TWEET_PREFIX}${tweetId}`,
      );
    });
  });

  describe('addUserCreatedTweetToZSet', () => {
    it('should successfully add a user-created tweet to the ZSET', async () => {
      const tweetId = '12345';
      const authorId = 67890;
      const hashtags = ['hashtag1', 'hashtag2'];
      const category = 'Tech';
      const location = 'NYC';
      const creationTimestamp = 1633024800; // Example timestamp
      const parentTweetId = '54321';

      const infix = TweetAtrrsJoinInfix;
      const parentTweetIdStr = parentTweetId ? parentTweetId.toString() : '-1';
      const memberItem = `${tweetId}${infix}${authorId.toString()}${infix}${hashtags.join('_')}${infix}${category}${infix}${location}${infix}${parentTweetIdStr}`;
      const key = `${CacheKeys.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET_PREFIX}${authorId}`;
      const ttl = CacheKeysTTLs.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET;

      jest.spyOn(service, 'addItemToZset').mockResolvedValueOnce();

      await expect(
        service.addUserCreatedTweetToZSet(
          tweetId,
          authorId,
          hashtags,
          category,
          location,
          creationTimestamp,
          parentTweetId,
        ),
      ).resolves.toBeUndefined();

      expect(service.addItemToZset).toHaveBeenCalledWith(
        key,
        memberItem,
        creationTimestamp,
        ttl,
      );
    });

    it('should handle when parentTweetId is undefined', async () => {
      const tweetId = '12345';
      const authorId = 67890;
      const hashtags = ['hashtag1', 'hashtag2'];
      const category = 'Tech';
      const location = 'NYC';
      const creationTimestamp = 1633024800; // Example timestamp
      const parentTweetId = undefined;

      const infix = TweetAtrrsJoinInfix;
      const parentTweetIdStr = parentTweetId ? parentTweetId.toString() : '-1';
      const memberItem = `${tweetId}${infix}${authorId.toString()}${infix}${hashtags.join('_')}${infix}${category}${infix}${location}${infix}${parentTweetIdStr}`;
      const key = `${CacheKeys.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET_PREFIX}${authorId}`;
      const ttl = CacheKeysTTLs.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET;

      jest.spyOn(service, 'addItemToZset').mockResolvedValueOnce();

      await expect(
        service.addUserCreatedTweetToZSet(
          tweetId,
          authorId,
          hashtags,
          category,
          location,
          creationTimestamp,
        ),
      ).resolves.toBeUndefined();

      expect(service.addItemToZset).toHaveBeenCalledWith(
        key,
        memberItem,
        creationTimestamp,
        ttl,
      );
    });

    it('should throw an error if addItemToZset fails', async () => {
      const tweetId = '12345';
      const authorId = 67890;
      const hashtags = ['hashtag1', 'hashtag2'];
      const category = 'Tech';
      const location = 'NYC';
      const creationTimestamp = 1633024800;
      const parentTweetId = '54321';

      jest
        .spyOn(service, 'addItemToZset')
        .mockRejectedValueOnce(new Error('Redis error'));

      await expect(
        service.addUserCreatedTweetToZSet(
          tweetId,
          authorId,
          hashtags,
          category,
          location,
          creationTimestamp,
          parentTweetId,
        ),
      ).rejects.toThrow('Redis error');

      const key = `${CacheKeys.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET_PREFIX}${authorId}`;
      const infix = TweetAtrrsJoinInfix;
      const parentTweetIdStr = parentTweetId ? parentTweetId.toString() : '-1';
      const memberItem = `${tweetId}${infix}${authorId.toString()}${infix}${hashtags.join('_')}${infix}${category}${infix}${location}${infix}${parentTweetIdStr}`;
      const ttl = CacheKeysTTLs.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET;

      expect(service.addItemToZset).toHaveBeenCalledWith(
        key,
        memberItem,
        creationTimestamp,
        ttl,
      );
    });
  });

  describe('paginateUserCreatedTweetIds', () => {
    it('should return parsed tweet keys from paginateZset results', async () => {
      const userId = 123;
      const creationTimestampFrom = 1637720000;
      const creationTimestampTo = 1637729999;
      const offset = 0;
      const limit = 10;

      // Example mock results from paginateZset
      const infix = TweetAtrrsJoinInfix;
      const mockZsetResults = [
        {
          item: `tweetId1${infix}123${infix}hashtag1${infix}Sport${infix}Location1${infix}-1`,
          score: 1637721323,
        },
        {
          item: `tweetId2${infix}123${infix}hashtag2${infix}Sport${infix}Location1${infix}tweetId1`,
          score: 1637724321,
        },
      ];

      // Mock paginateZset to return the mockZsetResults
      jest.spyOn(service, 'paginateZset').mockResolvedValue(mockZsetResults);

      // Mock parsePaginateZsetResults to return the expected TweetKey format
      const mockParsedResults = [
        {
          id: 'tweetId1',
          authorId: 123,
          parentTweetId: null,
          hashtags: ['hashtag1'],
          creationTimeStamp: 1637721323,
          category: 'Sport',
          location: 'Location1',
        },
        {
          id: 'tweetId2',
          authorId: 123,
          parentTweetId: 'tweetId1',
          hashtags: ['hashtag2'],
          creationTimeStamp: 1637724321,
          category: 'Sport',
          location: 'Location1',
        },
      ];
      jest
        .spyOn(service, 'parsePaginateZsetResults')
        .mockResolvedValue(mockParsedResults);

      const result = await service.paginateUserCreatedTweetIds(
        userId,
        creationTimestampFrom,
        creationTimestampTo,
        offset,
        limit,
      );

      expect(service.paginateZset).toHaveBeenCalledWith(
        `${CacheKeys.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET_PREFIX}${userId}`,
        creationTimestampFrom,
        creationTimestampTo,
        offset,
        limit,
      );

      expect(service.parsePaginateZsetResults).toHaveBeenCalledWith(
        mockZsetResults,
      );
      expect(result).toEqual(mockParsedResults);
    });

    it('should return empty array if paginateZset returns no results', async () => {
      const userId = 123;
      const creationTimestampFrom = 1637720000;
      const creationTimestampTo = 1637729999;
      const offset = 0;
      const limit = 10;

      // Mock paginateZset to return no results
      jest.spyOn(service, 'paginateZset').mockResolvedValue([]);

      const result = await service.paginateUserCreatedTweetIds(
        userId,
        creationTimestampFrom,
        creationTimestampTo,
        offset,
        limit,
      );

      expect(result).toEqual([]); // Should return an empty array
    });

    it('should throw an error if paginateZset fails', async () => {
      const userId = 123;
      const creationTimestampFrom = 1637720000;
      const creationTimestampTo = 1637729999;
      const offset = 0;
      const limit = 10;

      // Mock paginateZset to throw an error
      jest
        .spyOn(service, 'paginateZset')
        .mockRejectedValue(new Error('Error fetching data'));

      await expect(
        service.paginateUserCreatedTweetIds(
          userId,
          creationTimestampFrom,
          creationTimestampTo,
          offset,
          limit,
        ),
      ).rejects.toThrow('Error fetching data');
    });
  });

  describe('addItemToZset', () => {
    it('should successfully add an item to a ZSET and set expiration', async () => {
      const key = 'test-zset';
      const item = 'test-item';
      const score = 123;
      const ttl = 3600;

      // Mock zadd success
      jest.spyOn(mockRedisClient, 'zadd').mockResolvedValueOnce(1);
      // Mock expire success
      jest.spyOn(mockRedisClient, 'expire').mockResolvedValueOnce(1);

      await expect(
        service.addItemToZset(key, item, score, ttl),
      ).resolves.toBeUndefined();

      expect(mockRedisClient.zadd).toHaveBeenCalledWith(key, score, item);
      expect(mockRedisClient.expire).toHaveBeenCalledWith(key, ttl);
    });

    it('should throw an error if zadd fails', async () => {
      const key = 'test-zset';
      const item = 'test-item';
      const score = 123;
      const ttl = 3600;

      jest
        .spyOn(mockRedisClient, 'zadd')
        .mockRejectedValueOnce(new Error('zadd error'));

      await expect(
        service.addItemToZset(key, item, score, ttl),
      ).rejects.toThrow('Could not add public tweet to ZSET');

      expect(mockRedisClient.zadd).toHaveBeenCalledWith(key, score, item);
      expect(mockRedisClient.expire).not.toHaveBeenCalled();
    });

    it('should throw an error if expire fails', async () => {
      const key = 'test-zset';
      const item = 'test-item';
      const score = 123;
      const ttl = 3600;

      jest.spyOn(mockRedisClient, 'zadd').mockResolvedValueOnce(1);
      jest
        .spyOn(mockRedisClient, 'expire')
        .mockRejectedValueOnce(new Error('expire error'));

      await expect(
        service.addItemToZset(key, item, score, ttl),
      ).rejects.toThrow('Could not add public tweet to ZSET');

      expect(mockRedisClient.zadd).toHaveBeenCalledWith(key, score, item);
      expect(mockRedisClient.expire).toHaveBeenCalledWith(key, ttl);
    });

    it('should handle unexpected errors and log them', async () => {
      const key = 'test-zset';
      const item = 'test-item';
      const score = 123;
      const ttl = 3600;

      jest.spyOn(mockRedisClient, 'zadd').mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(
        service.addItemToZset(key, item, score, ttl),
      ).rejects.toThrow('Could not add public tweet to ZSET');
    });
  });

  describe('paginateZset', () => {
    it('should return paginated items from the ZSET', async () => {
      const key = 'example:zset';
      const scoreFrom = 100;
      const scoreTo = 0;
      const offset = 0;
      const limit = 5;

      // Mocked response from Redis
      const mockRedisResponse = ['item1', '95', 'item2', '85', 'item3', '75'];

      const expectedResults = [
        { item: 'item1', score: 95 },
        { item: 'item2', score: 85 },
        { item: 'item3', score: 75 },
      ];

      jest
        .spyOn(mockRedisClient, 'zrevrangebyscore')
        .mockResolvedValueOnce(mockRedisResponse);

      const results = await service.paginateZset(
        key,
        scoreFrom,
        scoreTo,
        offset,
        limit,
      );

      expect(results).toEqual(expectedResults);
      expect(mockRedisClient.zrevrangebyscore).toHaveBeenCalledWith(
        key,
        scoreTo,
        scoreFrom,
        'WITHSCORES',
        'LIMIT',
        offset,
        limit,
      );
    });

    it('should return an empty array if no items are found in the ZSET', async () => {
      const key = 'example:zset';
      const scoreFrom = 100;
      const scoreTo = 0;
      const offset = 0;
      const limit = 5;

      jest.spyOn(mockRedisClient, 'zrevrangebyscore').mockResolvedValueOnce([]);

      const results = await service.paginateZset(
        key,
        scoreFrom,
        scoreTo,
        offset,
        limit,
      );

      expect(results).toEqual([]);
      expect(mockRedisClient.zrevrangebyscore).toHaveBeenCalledWith(
        key,
        scoreTo,
        scoreFrom,
        'WITHSCORES',
        'LIMIT',
        offset,
        limit,
      );
    });

    it('should throw an error if Redis operation fails', async () => {
      const key = 'example:zset';
      const scoreFrom = 100;
      const scoreTo = 0;
      const offset = 0;
      const limit = 5;

      jest
        .spyOn(mockRedisClient, 'zrevrangebyscore')
        .mockRejectedValueOnce(new Error('Redis error'));

      await expect(
        service.paginateZset(key, scoreFrom, scoreTo, offset, limit),
      ).rejects.toThrow('Could not find items from Zset');

      expect(mockRedisClient.zrevrangebyscore).toHaveBeenCalledWith(
        key,
        scoreTo,
        scoreFrom,
        'WITHSCORES',
        'LIMIT',
        offset,
        limit,
      );
    });
  });

  describe('parsePaginateZsetResults', () => {
    it('should parse the Zset results correctly', async () => {
      const infix = TweetAtrrsJoinInfix;
      const zsetResults = [
        {
          item: `tweetId1${infix}123${infix}hashtag1_hashtag2${infix}Sport${infix}Location1${infix}-1`,
          score: 1637721323,
        },
        {
          item: `tweetId2${infix}456${infix}hashtag3${infix}Sport${infix}Location2${infix}tweetId1`,
          score: 1637724321,
        },
      ];

      const parsedResults = await service.parsePaginateZsetResults(zsetResults);

      expect(parsedResults).toEqual([
        {
          id: 'tweetId1',
          authorId: 123,
          parentTweetId: null,
          hashtags: ['hashtag1', 'hashtag2'],
          creationTimeStamp: 1637721323,
          category: 'Sport',
          location: 'Location1',
        },
        {
          id: 'tweetId2',
          authorId: 456,
          parentTweetId: 'tweetId1',
          hashtags: ['hashtag3'],
          creationTimeStamp: 1637724321,
          category: 'Sport',
          location: 'Location2',
        },
      ]);
    });

    it('should handle empty hashtags', async () => {
      const infix = TweetAtrrsJoinInfix;
      const zsetResults = [
        {
          item: `tweetId3${infix}789${infix}${infix}Tech${infix}Location3${infix}-1`,
          score: 1637731323,
        },
      ];

      const parsedResults = await service.parsePaginateZsetResults(zsetResults);

      expect(parsedResults).toEqual([
        {
          id: 'tweetId3',
          authorId: 789,
          parentTweetId: null,
          hashtags: [],
          creationTimeStamp: 1637731323,
          category: 'Tech',
          location: 'Location3',
        },
      ]);
    });

    it('should handle missing parentTweetId and default it to null', async () => {
      const infix = TweetAtrrsJoinInfix;
      const zsetResults = [
        {
          item: `tweetId4${infix}1010${infix}hashtag4${infix}News${infix}Location4${infix}-1`,
          score: 1637741323,
        },
      ];

      const parsedResults = await service.parsePaginateZsetResults(zsetResults);

      expect(parsedResults).toEqual([
        {
          id: 'tweetId4',
          authorId: 1010,
          parentTweetId: null,
          hashtags: ['hashtag4'],
          creationTimeStamp: 1637741323,
          category: 'News',
          location: 'Location4',
        },
      ]);
    });

    it('should correctly parse parentTweetId if provided', async () => {
      const infix = TweetAtrrsJoinInfix;
      const zsetResults = [
        {
          item: `tweetId5${infix}2021${infix}hashtag5${infix}Sport${infix}Location5${infix}tweetId4`,
          score: 1637751323,
        },
      ];

      const parsedResults = await service.parsePaginateZsetResults(zsetResults);

      expect(parsedResults).toEqual([
        {
          id: 'tweetId5',
          authorId: 2021,
          parentTweetId: 'tweetId4',
          hashtags: ['hashtag5'],
          creationTimeStamp: 1637751323,
          category: 'Sport',
          location: 'Location5',
        },
      ]);
    });
  });

  describe('addPublicViewableTweetToZSet', () => {
    it('should successfully add a public viewable tweet to the ZSET', async () => {
      const tweetId = '12345';
      const authorId = 67890;
      const hashtags = ['hashtag1', 'hashtag2'];
      const category = 'Tech';
      const location = 'NYC';
      const creationTimestamp = 1633024800; // Example timestamp
      const parentTweetId = '54321';

      const infix = TweetAtrrsJoinInfix;
      const parentTweetIdStr = parentTweetId ? parentTweetId.toString() : '-1';
      const memberItem = `${tweetId}${infix}${authorId.toString()}${infix}${hashtags.join('_')}${infix}${category}${infix}${location}${infix}${parentTweetIdStr}`;

      jest.spyOn(service, 'addItemToZset').mockResolvedValueOnce();

      await expect(
        service.addPublicViewableTweetToZSet(
          tweetId,
          authorId,
          hashtags,
          category,
          location,
          creationTimestamp,
          parentTweetId,
        ),
      ).resolves.toBeUndefined();

      expect(service.addItemToZset).toHaveBeenCalledWith(
        CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
        memberItem,
        creationTimestamp,
        CacheKeysTTLs.PUBLIC_VIEWABLE_TWEETS_ZSET,
      );
    });

    it('should handle when parentTweetId is undefined', async () => {
      const tweetId = '12345';
      const authorId = 67890;
      const hashtags = ['hashtag1', 'hashtag2'];
      const category = 'Tech';
      const location = 'NYC';
      const creationTimestamp = 1633024800; // Example timestamp
      const parentTweetId = undefined;

      const infix = TweetAtrrsJoinInfix;
      const parentTweetIdStr = parentTweetId ? parentTweetId.toString() : '-1';
      const memberItem = `${tweetId}${infix}${authorId.toString()}${infix}${hashtags.join('_')}${infix}${category}${infix}${location}${infix}${parentTweetIdStr}`;

      jest.spyOn(service, 'addItemToZset').mockResolvedValueOnce();

      await expect(
        service.addPublicViewableTweetToZSet(
          tweetId,
          authorId,
          hashtags,
          category,
          location,
          creationTimestamp,
        ),
      ).resolves.toBeUndefined();

      expect(service.addItemToZset).toHaveBeenCalledWith(
        CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
        memberItem,
        creationTimestamp,
        CacheKeysTTLs.PUBLIC_VIEWABLE_TWEETS_ZSET,
      );
    });

    it('should throw an error if addItemToZset fails', async () => {
      const tweetId = '12345';
      const authorId = 67890;
      const hashtags = ['hashtag1', 'hashtag2'];
      const category = 'Tech';
      const location = 'NYC';
      const creationTimestamp = 1633024800; // Example timestamp
      const parentTweetId = '54321';

      jest
        .spyOn(service, 'addItemToZset')
        .mockRejectedValueOnce(new Error('Redis error'));

      await expect(
        service.addPublicViewableTweetToZSet(
          tweetId,
          authorId,
          hashtags,
          category,
          location,
          creationTimestamp,
          parentTweetId,
        ),
      ).rejects.toThrow('Redis error');

      expect(service.addItemToZset).toHaveBeenCalled();
    });
  });

  describe('addPrivateViewableTweetToZSet', () => {
    it('should successfully add a private viewable tweet to the ZSET', async () => {
      const groupId = 123;
      const tweetId = '456';
      const authorId = 789;
      const hashtags = ['tag1', 'tag2'];
      const category = 'Tech';
      const location = 'NYC';
      const creationTimestamp = 1678901234; // Example timestamp
      const parentTweetId = '789';

      const infix = TweetAtrrsJoinInfix;
      const parentTweetIdStr = parentTweetId ? parentTweetId.toString() : '-1';
      const memberItem = `${tweetId}${infix}${authorId.toString()}${infix}${hashtags.join('_')}${infix}${category}${infix}${location}${infix}${parentTweetIdStr}`;
      const key = `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`;
      const ttl = CacheKeysTTLs.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET;

      jest.spyOn(service, 'addItemToZset').mockResolvedValueOnce();

      await expect(
        service.addPrivateViewableTweetToZSet(
          groupId,
          tweetId,
          authorId,
          hashtags,
          category,
          location,
          creationTimestamp,
          parentTweetId,
        ),
      ).resolves.toBeUndefined();

      expect(service.addItemToZset).toHaveBeenCalledWith(
        key,
        memberItem,
        creationTimestamp,
        ttl,
      );
    });

    it('should handle when parentTweetId is undefined', async () => {
      const groupId = 123;
      const tweetId = '456';
      const authorId = 789;
      const hashtags = ['tag1', 'tag2'];
      const category = 'Tech';
      const location = 'NYC';
      const creationTimestamp = 1678901234; // Example timestamp
      const parentTweetId = undefined;

      const infix = TweetAtrrsJoinInfix;
      const parentTweetIdStr = parentTweetId ? parentTweetId.toString() : '-1';
      const memberItem = `${tweetId}${infix}${authorId.toString()}${infix}${hashtags.join('_')}${infix}${category}${infix}${location}${infix}${parentTweetIdStr}`;
      const key = `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`;
      const ttl = CacheKeysTTLs.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET;

      jest.spyOn(service, 'addItemToZset').mockResolvedValueOnce();

      await expect(
        service.addPrivateViewableTweetToZSet(
          groupId,
          tweetId,
          authorId,
          hashtags,
          category,
          location,
          creationTimestamp,
        ),
      ).resolves.toBeUndefined();

      expect(service.addItemToZset).toHaveBeenCalledWith(
        key,
        memberItem,
        creationTimestamp,
        ttl,
      );
    });

    it('should throw an error if addItemToZset fails', async () => {
      const groupId = 123;
      const tweetId = '456';
      const authorId = 789;
      const hashtags = ['tag1', 'tag2'];
      const category = 'Tech';
      const location = 'NYC';
      const creationTimestamp = 1678901234; // Example timestamp
      const parentTweetId = '789';

      jest
        .spyOn(service, 'addItemToZset')
        .mockRejectedValueOnce(new Error('Redis error'));

      await expect(
        service.addPrivateViewableTweetToZSet(
          groupId,
          tweetId,
          authorId,
          hashtags,
          category,
          location,
          creationTimestamp,
          parentTweetId,
        ),
      ).rejects.toThrow('Redis error');

      const infix = TweetAtrrsJoinInfix;
      const parentTweetIdStr = parentTweetId ? parentTweetId.toString() : '-1';
      const memberItem = `${tweetId}${infix}${authorId.toString()}${infix}${hashtags.join('_')}${infix}${category}${infix}${location}${infix}${parentTweetIdStr}`;
      const key = `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`;
      const ttl = CacheKeysTTLs.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET;

      expect(service.addItemToZset).toHaveBeenCalledWith(
        key,
        memberItem,
        creationTimestamp,
        ttl,
      );
    });
  });

  describe('setTweetIsPublicEditable', () => {
    it('should set the correct key in Redis with value 1 and the correct TTL', async () => {
      // Arrange
      const tweetId = '123';
      const key = CacheKeys.PUBLIC_EDITABLE_TWEET_PREFIX + `${tweetId}`;
      const ttl = CacheKeysTTLs.PUBLIC_EDITABLE_TWEET;

      // Act
      await service.setTweetIsPublicEditable(tweetId);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, '1', 'EX', ttl);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if Redis throws an exception', async () => {
      // Arrange
      const tweetId = '123';
      const errorMessage = 'Redis error';
      mockRedisClient.set.mockRejectedValue(new Error(errorMessage)); // Mock Redis to throw an error

      // Act & Assert
      await expect(
        service.setTweetIsPublicEditable(tweetId),
      ).rejects.toThrowError('Redis error');
      const key = CacheKeys.PUBLIC_EDITABLE_TWEET_PREFIX + `${tweetId}`;
      const ttl = CacheKeysTTLs.PUBLIC_EDITABLE_TWEET;
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, '1', 'EX', ttl);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTweetIsPublicEditable', () => {
    it('should return the value if the tweet ID exists in the cache', async () => {
      // Arrange
      const tweetId = '12345';
      const mockResponse = '1'; // Expected value from cache
      const key = `${CacheKeys.PUBLIC_EDITABLE_TWEET_PREFIX}${tweetId}`;
      mockRedisClient.get.mockResolvedValue(mockResponse);

      // Act
      const result = await service.getTweetIsPublicEditable(tweetId);

      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe(mockResponse);
    });

    it('should return null if the tweet ID does not exist in the cache', async () => {
      // Arrange
      const tweetId = '12345';
      const key = `${CacheKeys.PUBLIC_EDITABLE_TWEET_PREFIX}${tweetId}`;
      mockRedisClient.get.mockResolvedValue(null);

      // Act
      const result = await service.getTweetIsPublicEditable(tweetId);

      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });

    it('should return null if Redis returns an error or undefined', async () => {
      // Arrange
      const tweetId = '12345';
      const key = `${CacheKeys.PUBLIC_EDITABLE_TWEET_PREFIX}${tweetId}`;
      mockRedisClient.get.mockResolvedValue(null);

      // Act
      const result = await service.getTweetIsPublicEditable(tweetId);

      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });
  });

  describe('SetTweetIsEditableByGroup', () => {
    it('should set the correct key with the value and TTL', async () => {
      const tweetId = 'tweet123';
      const groupId = 456;
      const expectedKey = `${CacheKeys.GROUP_EDITABLE_TWEET_PREFIX}${tweetId}:${groupId.toString()}`;
      const ttl = CacheKeysTTLs.GROUP_EDITABLE_TWEET;

      await service.setTweetIsEditableByGroup(tweetId, groupId);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expectedKey,
        '1',
        'EX',
        ttl,
      );
    });

    it('should throw an error if setting the key fails', async () => {
      mockRedisClient.set.mockRejectedValueOnce(new Error('Redis set error'));

      const tweetId = 'tweet123';
      const groupId = 456;

      await expect(
        service.setTweetIsEditableByGroup(tweetId, groupId),
      ).rejects.toThrow('Redis set error');
    });

    it('should use the correct TTL value', async () => {
      const tweetId = 'tweet123';
      const groupId = 789;
      const expectedKey = `${CacheKeys.GROUP_EDITABLE_TWEET_PREFIX}${tweetId}:${groupId.toString()}`;
      const ttl = CacheKeysTTLs.GROUP_EDITABLE_TWEET;

      await service.setTweetIsEditableByGroup(tweetId, groupId);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expectedKey,
        '1',
        'EX',
        ttl,
      );
      expect(ttl).toBeDefined();
    });
  });

  describe('getTweetIsEditableByGroup', () => {
    it('should retrieve the correct value for the given tweetId and groupId', async () => {
      const tweetId = 'tweet123';
      const groupId = 456;
      const expectedValue = '1';
      const key = `${CacheKeys.GROUP_EDITABLE_TWEET_PREFIX}${tweetId}:${groupId.toString()}`;

      mockRedisClient.get.mockResolvedValue(expectedValue);

      const result = await service.getTweetIsEditableByGroup(tweetId, groupId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe(expectedValue);
    });

    it('should return null if the key does not exist', async () => {
      const tweetId = 'tweet123';
      const groupId = 456;
      const key = `${CacheKeys.GROUP_EDITABLE_TWEET_PREFIX}${tweetId}:${groupId.toString()}`;

      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getTweetIsEditableByGroup(tweetId, groupId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const tweetId = 'tweet123';
      const groupId = 456;
      const key = `${CacheKeys.GROUP_EDITABLE_TWEET_PREFIX}${tweetId}:${groupId.toString()}`;

      mockRedisClient.get.mockRejectedValue(
        new Error('Redis connection error'),
      );

      await expect(
        service.getTweetIsEditableByGroup(tweetId, groupId),
      ).rejects.toThrow('Redis connection error');

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
    });
  });

  describe('paginatePublicTweetIds', () => {
    it('should return parsed tweet keys from paginateZset results', async () => {
      const creationTimestampFrom = 1637720000;
      const creationTimestampTo = 1637729999;
      const offset = 0;
      const limit = 10;

      // Example mock results from paginateZset
      const infix = TweetAtrrsJoinInfix;
      const mockZsetResults = [
        {
          item: `tweetId1${infix}123${infix}hashtag1${infix}Sport${infix}Location1${infix}-1`,
          score: 1637721323,
        },
        {
          item: `tweetId2${infix}123${infix}hashtag2${infix}Sport${infix}Location1${infix}tweetId1`,
          score: 1637724321,
        },
      ];

      // Mock paginateZset to return the mockZsetResults
      jest.spyOn(service, 'paginateZset').mockResolvedValue(mockZsetResults);

      // Mock parsePaginateZsetResults to return the expected TweetKey format
      const mockParsedResults = [
        {
          id: 'tweetId1',
          authorId: 123,
          parentTweetId: null,
          hashtags: ['hashtag1'],
          creationTimeStamp: 1637721323,
          category: 'Sport',
          location: 'Location1',
        },
        {
          id: 'tweetId2',
          authorId: 123,
          parentTweetId: 'tweetId1',
          hashtags: ['hashtag2'],
          creationTimeStamp: 1637724321,
          category: 'Sport',
          location: 'Location1',
        },
      ];
      jest
        .spyOn(service, 'parsePaginateZsetResults')
        .mockResolvedValue(mockParsedResults);

      const result = await service.paginatePublicTweetIds(
        creationTimestampFrom,
        creationTimestampTo,
        offset,
        limit,
      );

      expect(service.paginateZset).toHaveBeenCalledWith(
        CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
        creationTimestampFrom,
        creationTimestampTo,
        offset,
        limit,
      );

      expect(service.parsePaginateZsetResults).toHaveBeenCalledWith(
        mockZsetResults,
      );
      expect(result).toEqual(mockParsedResults);
    });

    it('should return empty array if paginateZset returns no results', async () => {
      const creationTimestampFrom = 1637720000;
      const creationTimestampTo = 1637729999;
      const offset = 0;
      const limit = 10;

      // Mock paginateZset to return no results
      jest.spyOn(service, 'paginateZset').mockResolvedValue([]);

      const result = await service.paginatePublicTweetIds(
        creationTimestampFrom,
        creationTimestampTo,
        offset,
        limit,
      );

      expect(result).toEqual([]); // Should return an empty array
    });

    it('should throw an error if paginateZset fails', async () => {
      const creationTimestampFrom = 1637720000;
      const creationTimestampTo = 1637729999;
      const offset = 0;
      const limit = 10;

      // Mock paginateZset to throw an error
      jest
        .spyOn(service, 'paginateZset')
        .mockRejectedValue(new Error('Error fetching data'));

      await expect(
        service.paginatePublicTweetIds(
          creationTimestampFrom,
          creationTimestampTo,
          offset,
          limit,
        ),
      ).rejects.toThrow('Error fetching data');
    });
  });

  describe('paginatePrivateTweetIds', () => {
    it('should return parsed tweet keys from paginateZset results', async () => {
      const groupId = 1;
      const creationTimestampFrom = 1637720000;
      const creationTimestampTo = 1637729999;
      const offset = 0;
      const limit = 10;

      // Example mock results from paginateZset
      const mockZsetResults = [
        { item: 'tweetId1_123_hashtag1_Sport_Location1_-1', score: 1637721323 },
        {
          item: 'tweetId2_123_hashtag2_Sport_Location1_tweetId1',
          score: 1637724321,
        },
      ];

      // Mock paginateZset to return the mockZsetResults
      jest.spyOn(service, 'paginateZset').mockResolvedValue(mockZsetResults);

      // Mock parsePaginateZsetResults to return the expected TweetKey format
      const mockParsedResults = [
        {
          id: 'tweetId1',
          authorId: 123,
          parentTweetId: null,
          hashtags: ['hashtag1'],
          creationTimeStamp: 1637721323,
          category: 'Sport',
          location: 'Location1',
        },
        {
          id: 'tweetId2',
          authorId: 123,
          parentTweetId: 'tweetId1',
          hashtags: ['hashtag2'],
          creationTimeStamp: 1637724321,
          category: 'Sport',
          location: 'Location1',
        },
      ];
      jest
        .spyOn(service, 'parsePaginateZsetResults')
        .mockResolvedValue(mockParsedResults);

      const result = await service.paginatePrivateTweetIds(
        groupId,
        creationTimestampFrom,
        creationTimestampTo,
        offset,
        limit,
      );

      expect(service.paginateZset).toHaveBeenCalledWith(
        `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId}`,
        creationTimestampFrom,
        creationTimestampTo,
        offset,
        limit,
      );

      expect(service.parsePaginateZsetResults).toHaveBeenCalledWith(
        mockZsetResults,
      );
      expect(result).toEqual(mockParsedResults);
    });
  });
});
