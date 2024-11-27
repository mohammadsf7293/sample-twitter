import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { Redis } from 'ioredis';

describe('CacheService (Integration)', () => {
  let service: CacheService;
  let redisClient: Redis;

  beforeAll(async () => {
    // Set up a real Redis client
    redisClient = new Redis({
      host: 'localhost',
      port: 6379,
      db: 1,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: 'REDIS',
          useValue: redisClient,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);

    // Flushing redis to make sure we have a stateless integration test
    service.flushDB();
  });

  afterAll(async () => {
    // Clean up Redis connections
    await redisClient.quit();
  });

  it('should set and get a value from Redis', async () => {
    const key = 'testKey';
    const value = 'testValue';

    await service.setValue(key, value);

    const result = await service.getValue(key);

    // Assert: the result should be the value we set
    expect(result).toBe(value);
  });

  it('should return null if the key does not exist in Redis', async () => {
    const key = 'nonExistentKey';

    // Act: try to get a non-existent key
    const result = await service.getValue(key);

    // Assert: the result should be null (not found)
    expect(result).toBeNull();
  });
});
