import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { CacheKeys, CacheKeysTTLs } from './constants/cache.constants';

describe('CacheService', () => {
  let service: CacheService;
  let mockRedisClient: {
    set: jest.Mock;
    get: jest.Mock;
    zadd: jest.Mock;
    expire: jest.Mock;
  };

  beforeEach(async () => {
    // Create a mocked Redis client
    mockRedisClient = {
      set: jest.fn(),
      get: jest.fn(),
      zadd: jest.fn(),
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
});
