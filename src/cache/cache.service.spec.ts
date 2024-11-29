import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { CacheKeys } from './constants/cache-keys.constants';

describe('CacheService', () => {
  let service: CacheService;
  let mockRedisClient: {
    set: jest.Mock;
    get: jest.Mock;
    zadd: jest.Mock;
  };

  beforeEach(async () => {
    // Create a mocked Redis client
    mockRedisClient = {
      set: jest.fn(),
      get: jest.fn(),
      zadd: jest.fn(),
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

  it('should set and get a value from Redis', async () => {
    const key = 'testKey';
    const value = 'testValue';

    // Mock Redis set and get methods
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.get.mockResolvedValue(value);

    // Act: Set and then get the value
    await service.setValue(key, value);
    const result = await service.getValue(key);

    // Assert: Ensure the correct calls were made and the value is retrieved
    expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
    expect(mockRedisClient.get).toHaveBeenCalledWith(key);
    expect(result).toBe(value);
  });

  it('should return null if the key does not exist in Redis', async () => {
    const key = 'nonExistentKey';

    // Mock Redis get method to return null
    mockRedisClient.get.mockResolvedValue(null);

    // Act: Try to get a non-existent key
    const result = await service.getValue(key);

    // Assert: Ensure the get call was made and the result is null
    expect(mockRedisClient.get).toHaveBeenCalledWith(key);
    expect(result).toBeNull();
  });

  describe('addPublicTweetToZSet', () => {
    it('should add a public tweet to the ZSET with the correct score and value', async () => {
      const tweetId = '12345';
      const hashtags = ['fun', 'coding'];
      const category = 'tech';
      const creationTimestamp = 1670000000;

      // Call the method
      await (service as any).addPublicTweetToZSet(
        tweetId,
        hashtags,
        category,
        creationTimestamp,
      );

      // Verify that the zadd command was called with the expected arguments
      const memberItem = `${tweetId}_${hashtags.join('_')}_${category}`;
      expect(mockRedisClient.zadd).toHaveBeenCalledWith(
        CacheKeys.PUBLIC_TWEETS_ZSET,
        creationTimestamp,
        memberItem,
      );
    });
  });
});
