import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { CacheKeys, CacheKeysTTLs } from './constants/cache.constants';

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
    it('should successfully add tweet to ZSET', async () => {
      // Arrange
      const userId = 123;
      const tweetId = 'tweet123';
      const hashtags = ['#test', '#new'];
      const category = 'news';
      const creationTimestamp = Date.now();

      const key = `${CacheKeys.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET_PREFIX}${userId}`;
      const memberItem = `${tweetId}_${hashtags.join('_')}_${category}`;

      jest.spyOn(mockRedisClient, 'zadd').mockResolvedValue(1);
      jest.spyOn(mockRedisClient, 'expire').mockResolvedValue(1);

      // Act
      await service.addUserCreatedTweetToZSet(
        userId,
        tweetId,
        hashtags,
        category,
        creationTimestamp,
      );

      // Assert
      expect(mockRedisClient.zadd).toHaveBeenCalledWith(
        key,
        creationTimestamp,
        memberItem,
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        key,
        CacheKeysTTLs.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET,
      );
    });

    it('should throw an error if Redis fails to add tweet to ZSET', async () => {
      // Arrange
      const userId = 123;
      const tweetId = 'tweet123';
      const hashtags = ['#test', '#new'];
      const category = 'news';
      const creationTimestamp = Date.now();

      jest
        .spyOn(mockRedisClient, 'zadd')
        .mockRejectedValue(new Error('Redis failure'));
      jest
        .spyOn(mockRedisClient, 'expire')
        .mockRejectedValue(new Error('Redis failure'));

      // Act & Assert
      await expect(
        service.addUserCreatedTweetToZSet(
          userId,
          tweetId,
          hashtags,
          category,
          creationTimestamp,
        ),
      ).rejects.toThrow('Could not add public tweet to ZSET');

      expect(mockRedisClient.zadd).toHaveBeenCalled();
      expect(mockRedisClient.expire).toHaveBeenCalledTimes(0);
    });
  });

  describe('paginateUserCreatedTweetIds', () => {
    it('should paginate user created tweet IDs correctly', async () => {
      // Arrange
      const userId = 123;
      const creationTimestampFrom = 1670000000000;
      const creationTimestampTo = 1679999999999;
      const offset = 0;
      const limit = 10;

      const key = `${CacheKeys.PRIVATE_USER_SELF_CREATED_TWEETS_ZSET_PREFIX}${userId}`;
      const mockMembers = [
        'tweet_1_#test_news',
        '1670001000000',
        'tweet_2_#new_tech',
        '1670002000000',
        'tweet_3_#cool_updates',
        '1670003000000',
      ]; // Mock return value from zrevrangebyscore

      jest
        .spyOn(mockRedisClient, 'zrevrangebyscore')
        .mockResolvedValue(mockMembers);

      // Act
      const result = await service.paginateUserCreatedTweetIds(
        userId,
        creationTimestampFrom,
        creationTimestampTo,
        offset,
        limit,
      );

      // Assert
      expect(mockRedisClient.zrevrangebyscore).toHaveBeenCalledWith(
        key,
        creationTimestampTo,
        creationTimestampFrom,
        'WITHSCORES',
        'LIMIT',
        offset,
        limit,
      );
      expect(result).toEqual([
        { item: 'tweet_1_#test_news', score: 1670001000000 },
        { item: 'tweet_2_#new_tech', score: 1670002000000 },
        { item: 'tweet_3_#cool_updates', score: 1670003000000 },
      ]);
    });

    it('should throw an error if Redis fails to fetch tweet IDs', async () => {
      // Arrange
      const userId = 123;
      const creationTimestampFrom = 1670000000000;
      const creationTimestampTo = 1679999999999;
      const offset = 0;
      const limit = 10;

      jest
        .spyOn(mockRedisClient, 'zrevrangebyscore')
        .mockRejectedValue(new Error('Redis failure'));

      // Act & Assert
      await expect(
        service.paginateUserCreatedTweetIds(
          userId,
          creationTimestampFrom,
          creationTimestampTo,
          offset,
          limit,
        ),
      ).rejects.toThrow('Could not find items from Zset');

      expect(mockRedisClient.zrevrangebyscore).toHaveBeenCalled();
    });

    it('should log an error if Redis fails to fetch tweet IDs', async () => {
      // Arrange
      const userId = 123;
      const creationTimestampFrom = 1670000000000;
      const creationTimestampTo = 1679999999999;
      const offset = 0;
      const limit = 10;

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      jest
        .spyOn(mockRedisClient, 'zrevrangebyscore')
        .mockRejectedValue(new Error('Redis failure'));

      // Act
      await expect(
        service.paginateUserCreatedTweetIds(
          userId,
          creationTimestampFrom,
          creationTimestampTo,
          offset,
          limit,
        ),
      ).rejects.toThrow('Could not find items from Zset');

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching items from zset:',
        new Error('Redis failure'),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('addPublicViewableTweetToZSet', () => {
    it('should add a public tweet to the ZSET with the correct score and value', async () => {
      const tweetId = '12345';
      const hashtags = ['fun', 'coding'];
      const category = 'tech';
      const creationTimestamp = 1670000000;

      // Call the method
      await (service as any).addPublicViewableTweetToZSet(
        tweetId,
        hashtags,
        category,
        creationTimestamp,
      );

      // Verify that the zadd command was called with the expected arguments
      const memberItem = `${tweetId}_${hashtags.join('_')}_${category}`;
      expect(mockRedisClient.zadd).toHaveBeenCalledWith(
        CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
        creationTimestamp,
        memberItem,
      );

      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
        CacheKeysTTLs.PUBLIC_VIEWABLE_TWEETS_ZSET,
      );
    });
  });

  describe('addPrivateViewableTweetToZSet', () => {
    it('should add a private viewable tweet to the ZSET and set TTL', async () => {
      // Arrange
      const groupId = 1;
      const tweetId = 'tweet123';
      const hashtags = ['#hashtag1', '#hashtag2'];
      const category = 'tech';
      const creationTimestamp = 1627681443000;
      const expectedKey = `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`;
      const expectedMemberItem = `${tweetId}_${hashtags.join('_')}_${category}`;

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);

      // Act
      await service.addPrivateViewableTweetToZSet(
        groupId,
        tweetId,
        hashtags,
        category,
        creationTimestamp,
      );

      // Assert
      expect(mockRedisClient.zadd).toHaveBeenCalledWith(
        expectedKey,
        creationTimestamp,
        expectedMemberItem,
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        expectedKey,
        CacheKeysTTLs.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET,
      );
    });

    it('should throw an error if adding tweet to ZSET fails', async () => {
      // Arrange
      const groupId = 1;
      const tweetId = 'tweet123';
      const hashtags = ['#hashtag1', '#hashtag2'];
      const category = 'tech';
      const creationTimestamp = 1627681443000;
      const expectedKey = `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`;
      const expectedMemberItem = `${tweetId}_${hashtags.join('_')}_${category}`;

      mockRedisClient.zadd.mockRejectedValue(new Error('Redis failure'));

      // Act & Assert
      await expect(
        service.addPrivateViewableTweetToZSet(
          groupId,
          tweetId,
          hashtags,
          category,
          creationTimestamp,
        ),
      ).rejects.toThrowError('Could not add public tweet to ZSET');
      expect(mockRedisClient.zadd).toHaveBeenCalledWith(
        expectedKey,
        creationTimestamp,
        expectedMemberItem,
      );
    });

    it('should handle the error if Redis expires call fails', async () => {
      // Arrange
      const groupId = 1;
      const tweetId = 'tweet123';
      const hashtags = ['#hashtag1', '#hashtag2'];
      const category = 'tech';
      const creationTimestamp = 1627681443000;
      const expectedKey = `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`;
      const expectedMemberItem = `${tweetId}_${hashtags.join('_')}_${category}`;

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.expire.mockRejectedValue(new Error('Expire failed'));

      // Act & Assert
      await expect(
        service.addPrivateViewableTweetToZSet(
          groupId,
          tweetId,
          hashtags,
          category,
          creationTimestamp,
        ),
      ).rejects.toThrowError('Could not add public tweet to ZSET');
      expect(mockRedisClient.zadd).toHaveBeenCalledWith(
        expectedKey,
        creationTimestamp,
        expectedMemberItem,
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        expectedKey,
        CacheKeysTTLs.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET,
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
    it('should return an array of items with scores', async () => {
      // Mocking Redis response
      const mockRedisResponse = ['tweet1', '150', 'tweet2', '145'];
      mockRedisClient.zrevrangebyscore.mockResolvedValue(mockRedisResponse);

      const result = await service.paginatePublicTweetIds(100, 200, 0, 10);

      expect(result).toEqual([
        { item: 'tweet1', score: 150 },
        { item: 'tweet2', score: 145 },
      ]);
      expect(mockRedisClient.zrevrangebyscore).toHaveBeenCalledWith(
        CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
        200,
        100,
        'WITHSCORES',
        'LIMIT',
        0,
        10,
      );
    });

    it('should return an empty array if no members are found', async () => {
      mockRedisClient.zrevrangebyscore.mockResolvedValue([]);

      const result = await service.paginatePublicTweetIds(100, 200, 0, 10);

      expect(result).toEqual([]);
      expect(mockRedisClient.zrevrangebyscore).toHaveBeenCalledWith(
        CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
        200,
        100,
        'WITHSCORES',
        'LIMIT',
        0,
        10,
      );
    });

    it('should throw an error if Redis operation fails', async () => {
      mockRedisClient.zrevrangebyscore.mockRejectedValue(
        new Error('Redis error'),
      );

      await expect(
        service.paginatePublicTweetIds(100, 200, 0, 10),
      ).rejects.toThrow('Could not find items from Zset');
      expect(mockRedisClient.zrevrangebyscore).toHaveBeenCalledWith(
        CacheKeys.PUBLIC_VIEWABLE_TWEETS_ZSET,
        200,
        100,
        'WITHSCORES',
        'LIMIT',
        0,
        10,
      );
    });

    it('should handle a mix of items and scores correctly', async () => {
      // Mock Redis response with more items
      const mockRedisResponse = [
        'tweet1',
        '150',
        'tweet2',
        '145',
        'tweet3',
        '140',
      ];
      mockRedisClient.zrevrangebyscore.mockResolvedValue(mockRedisResponse);

      const result = await service.paginatePublicTweetIds(100, 200, 0, 10);

      expect(result).toEqual([
        { item: 'tweet1', score: 150 },
        { item: 'tweet2', score: 145 },
        { item: 'tweet3', score: 140 },
      ]);
    });
  });

  describe('paginatePrivateTweetIds', () => {
    it('should return an array of items with scores', async () => {
      // Mocking Redis response
      const mockRedisResponse = ['tweet1', '150', 'tweet2', '145'];
      mockRedisClient.zrevrangebyscore.mockResolvedValue(mockRedisResponse);

      const groupId = 1;
      const result = await service.paginatePrivateTweetIds(
        groupId,
        100,
        200,
        0,
        10,
      );

      expect(result).toEqual([
        { item: 'tweet1', score: 150 },
        { item: 'tweet2', score: 145 },
      ]);
      expect(mockRedisClient.zrevrangebyscore).toHaveBeenCalledWith(
        `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`,
        200,
        100,
        'WITHSCORES',
        'LIMIT',
        0,
        10,
      );
    });

    it('should return an empty array if no members are found', async () => {
      mockRedisClient.zrevrangebyscore.mockResolvedValue([]);

      const groupId = 1;
      const result = await service.paginatePrivateTweetIds(
        groupId,
        100,
        200,
        0,
        10,
      );

      expect(result).toEqual([]);
      expect(mockRedisClient.zrevrangebyscore).toHaveBeenCalledWith(
        `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`,
        200,
        100,
        'WITHSCORES',
        'LIMIT',
        0,
        10,
      );
    });

    it('should throw an error if Redis operation fails', async () => {
      mockRedisClient.zrevrangebyscore.mockRejectedValue(
        new Error('Redis error'),
      );

      const groupId = 1;
      await expect(
        service.paginatePrivateTweetIds(groupId, 100, 200, 0, 10),
      ).rejects.toThrow('Could not find items from Zset');
      expect(mockRedisClient.zrevrangebyscore).toHaveBeenCalledWith(
        `${CacheKeys.PRIVATE_GROUP_VIEWABLE_TWEETS_ZSET_PREFIX}${groupId.toString()}`,
        200,
        100,
        'WITHSCORES',
        'LIMIT',
        0,
        10,
      );
    });

    it('should handle a mix of items and scores correctly', async () => {
      // Mock Redis response with more items
      const mockRedisResponse = [
        'tweet1',
        '150',
        'tweet2',
        '145',
        'tweet3',
        '140',
      ];
      mockRedisClient.zrevrangebyscore.mockResolvedValue(mockRedisResponse);

      const groupId = 1;
      const result = await service.paginatePrivateTweetIds(
        groupId,
        100,
        200,
        0,
        10,
      );

      expect(result).toEqual([
        { item: 'tweet1', score: 150 },
        { item: 'tweet2', score: 145 },
        { item: 'tweet3', score: 140 },
      ]);
    });
  });
});
