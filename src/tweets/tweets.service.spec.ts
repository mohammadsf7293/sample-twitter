/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TweetsService } from './tweets.service';
import { Tweet, TweetCategory } from './tweet.entity';
import { User } from '../users/user.entity';
import { Hashtag } from './hashtag.entity';
import { UpdateTweetDto } from './dto/update-tweet.dto';
import { CacheService } from '../cache/cache.service';
import { GroupsService } from '../groups/groups.service';
import { UpdateTweetPermissionsDto } from './dto/update-tweet-permissions.dto';
import { Group } from 'src/groups/group.entity';
import { UsersService } from '../users/users.service';
import * as protobuf from 'protobufjs';
import * as path from 'path';
import { CreateTweetDto } from './dto/create-tweet.dto';

const mockTweetRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

const mockHashtagRepository = {
  findBy: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockCacheService = {
  setValue: jest.fn(),
  getValue: jest.fn(),
  cacheTweet: jest.fn(),
  getCachedTweet: jest.fn(),
  addPublicViewableTweetToZSet: jest.fn(),
  paginatePublicTweetIds: jest.fn(),
  addPrivateViewableTweetToZSet: jest.fn(),
  paginatePrivateTweetIds: jest.fn(),
  setTweetIsPublicEditable: jest.fn(),
  getTweetIsPublicEditable: jest.fn(),
  setTweetIsEditableByGroup: jest.fn(),
  getTweetIsEditableByGroup: jest.fn(),
  addUserCreatedTweetToZSet: jest.fn(),
  paginateUserCreatedTweetIds: jest.fn(),
};

const mockGroupsService = {
  findUserGroupsByUserIds: jest.fn(),
  findGroupsByIds: jest.fn(),
  create: jest.fn(),
};

const mockUsersService = {
  findOne: jest.fn(),
  isUserInGroupIds: jest.fn(),
  findOneWithRelations: jest.fn(),
};

const mockUser = {
  id: 1,
  name: 'Test User',
  groups: [{ id: 1 }],
} as unknown as User;

const mockUser2 = {
  id: 2,
  name: 'Test User2',
  groups: [{ id: 1 }],
} as unknown as User;

const mockTweet = {
  id: '1',
  content: 'Test tweet',
  author: mockUser2,
  editableGroups: [{ id: 1 }, { id: 2 }],
  parentTweet: null,
  hashtags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Tweet;

describe('TweetsService', () => {
  let service: TweetsService;
  let tweetRepository: Repository<Tweet>;
  let hashtagRepository: Repository<Hashtag>;
  let cacheService: CacheService;
  let usersService: UsersService;

  beforeAll(() => {
    // Suppressing console.error not to show thrown exceptions which are used for some test cases. It makes test output area clean and green. and it only becomes red when a test is not passed
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TweetsService,
        {
          provide: getRepositoryToken(Tweet),
          useValue: mockTweetRepository,
        },
        {
          provide: getRepositoryToken(Hashtag),
          useValue: mockHashtagRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: GroupsService,
          useValue: mockGroupsService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<TweetsService>(TweetsService);
    tweetRepository = module.get<Repository<Tweet>>(getRepositoryToken(Tweet));
    hashtagRepository = module.get<Repository<Hashtag>>(
      getRepositoryToken(Hashtag),
    );
    cacheService = module.get<CacheService>(CacheService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a tweet successfully', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'This is a tweet',
        authorId: 1,
        parentTweetId: null,
        hashtags: ['#tech', '#news'],
        location: 'New York',
        category: TweetCategory.Tech,
      };

      const author = { id: 1, name: 'User' } as unknown as User;
      jest.spyOn(usersService, 'findOne').mockResolvedValue(author);

      const existingHashtags = [{ name: '#tech' } as Hashtag];
      jest
        .spyOn(hashtagRepository, 'findBy')
        .mockResolvedValue(existingHashtags);

      const newHashtags = ['#news'];
      jest
        .spyOn(hashtagRepository, 'create')
        .mockImplementation((name) => ({ name }) as Hashtag);
      jest
        .spyOn(hashtagRepository, 'save')
        .mockResolvedValue({ name: '#news' } as Hashtag);

      const savedTweet = {
        id: 'tweetId',
        ...createTweetDto,
        author: mockUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Tweet;
      jest.spyOn(tweetRepository, 'save').mockResolvedValue(savedTweet);

      jest.spyOn(cacheService, 'addUserCreatedTweetToZSet').mockResolvedValue();

      // Act
      const result = await service.create(createTweetDto);

      // Assert
      expect(result).toEqual(savedTweet);
      expect(usersService.findOne).toHaveBeenCalledWith(
        createTweetDto.authorId,
      );
      expect(tweetRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          content: createTweetDto.content,
          author: author,
          parentTweet: null,
          location: createTweetDto.location,
          category: createTweetDto.category,
          hashtags: expect.arrayContaining([
            expect.objectContaining({ name: '#tech' }),
            expect.objectContaining({ name: '#news' }),
          ]),
        }),
      );
      expect(cacheService.addUserCreatedTweetToZSet).toHaveBeenCalled();
    });

    it('should throw error if author is not found', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'This is a tweet',
        authorId: 999, // Invalid author ID
        parentTweetId: null,
        hashtags: ['#tech'],
        location: 'New York',
        category: TweetCategory.Tech,
      };

      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createTweetDto)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw error if parent tweet is not found', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'This is a tweet',
        authorId: 1,
        parentTweetId: '1', // Invalid parent tweet ID
        hashtags: ['#tech'],
        location: 'New York',
        category: TweetCategory.Tech,
      };

      const author = { id: 1, name: 'User' } as unknown as User;
      jest.spyOn(usersService, 'findOne').mockResolvedValue(author);

      jest.spyOn(tweetRepository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createTweetDto)).rejects.toThrow(
        'Parent tweet not found',
      );
    });

    it('should handle hashtags correctly, creating new ones when needed', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'This is a tweet',
        authorId: 1,
        parentTweetId: null,
        hashtags: ['#tech', '#newHashtag'],
        location: 'New York',
        category: TweetCategory.Tech,
      };

      const author = { id: 1, name: 'User' } as unknown as User;
      jest.spyOn(usersService, 'findOne').mockResolvedValue(author);

      const existingHashtags = [{ name: '#tech' } as unknown as Hashtag];
      jest
        .spyOn(hashtagRepository, 'findBy')
        .mockResolvedValue(existingHashtags);

      jest
        .spyOn(hashtagRepository, 'create')
        .mockReturnValue({ name: '#newHashtag' } as Hashtag);

      jest
        .spyOn(hashtagRepository, 'save')
        .mockResolvedValue({ name: '#newHashtag' } as Hashtag);

      const savedTweet = {
        id: 'tweetId',
        author: mockUser,
        ...createTweetDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Tweet;
      jest.spyOn(tweetRepository, 'save').mockResolvedValue(savedTweet);

      jest
        .spyOn(cacheService, 'addUserCreatedTweetToZSet')
        .mockResolvedValue(undefined);

      // Act
      const result = await service.create(createTweetDto);

      // Assert
      expect(result).toEqual(savedTweet);
      expect(hashtagRepository.save).toHaveBeenCalledWith({
        name: '#newHashtag',
      });
    });

    it('should throw an error if Redis fails to cache the tweet', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'This is a tweet',
        authorId: 1,
        parentTweetId: null,
        hashtags: ['#tech'],
        location: 'New York',
        category: TweetCategory.Tech,
      };

      const author = { id: 1, name: 'User' } as unknown as User;
      jest.spyOn(usersService, 'findOne').mockResolvedValue(author);

      const existingHashtags = [{ name: '#tech' } as Hashtag];
      jest
        .spyOn(hashtagRepository, 'findBy')
        .mockResolvedValue(existingHashtags);

      const savedTweet = {
        id: 'tweetId',
        author: mockUser,
        ...createTweetDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Tweet;
      jest.spyOn(tweetRepository, 'save').mockResolvedValue(savedTweet);

      jest
        .spyOn(cacheService, 'addUserCreatedTweetToZSet')
        .mockRejectedValue(new Error('Redis failure'));

      // Act & Assert
      await expect(service.create(createTweetDto)).rejects.toThrow(
        'Redis failure',
      );
    });
  });

  describe('cacheTweet', () => {
    it('should cache the tweet with serialized data', async () => {
      await service.cacheTweet(mockTweet);

      const expectedTweetData = {
        id: mockTweet.id,
        content: mockTweet.content,
        author: mockTweet.author,
        category: mockTweet.category,
        hashtags: mockTweet.hashtags,
        location: mockTweet.location,
        createdAt: mockTweet.createdAt.getTime(),
        updatedAt: mockTweet.updatedAt.getTime(),
      };

      const expectedEncodedTweetString = JSON.stringify(expectedTweetData);

      expect(mockCacheService.cacheTweet).toHaveBeenCalledWith(
        mockTweet.id,
        expectedEncodedTweetString,
      );
    });

    it('should handle tweets with missing optional fields', async () => {
      const tweetWithMissingFields: Tweet = {
        ...mockTweet,
        location: null,
        category: null,
        hashtags: [],
      };

      await service.cacheTweet(tweetWithMissingFields);

      const expectedTweetData = {
        id: tweetWithMissingFields.id,
        content: tweetWithMissingFields.content,
        author: tweetWithMissingFields.author,
        category: null,
        hashtags: [],
        location: null,
        createdAt: tweetWithMissingFields.createdAt.getTime(),
        updatedAt: tweetWithMissingFields.updatedAt.getTime(),
      };

      const expectedEncodedTweetString = JSON.stringify(expectedTweetData);

      expect(mockCacheService.cacheTweet).toHaveBeenCalledWith(
        tweetWithMissingFields.id,
        expectedEncodedTweetString,
      );
    });

    it('should throw an error if the CacheService fails', async () => {
      mockCacheService.cacheTweet.mockRejectedValue(new Error('Redis error'));

      await expect(service.cacheTweet(mockTweet)).rejects.toThrow(
        'Redis error',
      );

      expect(mockCacheService.cacheTweet).toHaveBeenCalled();
    });
  });

  describe('getCachedTweet', () => {
    it('should return a Tweet entity when cached data exists', async () => {
      mockCacheService.getCachedTweet.mockResolvedValue(
        JSON.stringify(mockTweet),
      );

      const result = await service.getCachedTweet('1');

      expect(result).toBeInstanceOf(Tweet);
      expect(result.id).toBe(mockTweet.id);
      expect(result.content).toBe(mockTweet.content);
      expect(result.category).toBe(mockTweet.category);
      expect(result.location).toBe(mockTweet.location);
      expect(result.createdAt).toEqual(new Date(mockTweet.createdAt));
      expect(result.updatedAt).toEqual(new Date(mockTweet.updatedAt));
      expect(result.author.id).toBe(mockTweet.author.id);
      expect(result.hashtags).toEqual(mockTweet.hashtags);

      expect(mockCacheService.getCachedTweet).toHaveBeenCalledWith('1');
    });

    it('should return null when no cached data is found', async () => {
      mockCacheService.getCachedTweet.mockResolvedValue(null);

      const result = await service.getCachedTweet('1');

      expect(result).toBeNull();
      expect(mockCacheService.getCachedTweet).toHaveBeenCalledWith('1');
    });

    it('should throw an error when JSON parsing fails', async () => {
      mockCacheService.getCachedTweet.mockResolvedValue('invalid-json');

      await expect(service.getCachedTweet('1')).rejects.toThrow(
        'Could not retrieve cached tweet: Unexpected token \'i\', "invalid-json" is not valid JSON',
      );

      expect(mockCacheService.getCachedTweet).toHaveBeenCalledWith('1');
    });

    it('should throw an error when CacheService fails', async () => {
      mockCacheService.getCachedTweet.mockRejectedValue(
        new Error('Redis connection error'),
      );

      await expect(service.getCachedTweet('1')).rejects.toThrow(
        'Could not retrieve cached tweet: Redis connection error',
      );

      expect(mockCacheService.getCachedTweet).toHaveBeenCalledWith('1');
    });
  });

  describe('paginateTweets', () => {
    it('should return paginated tweets with hasNextPage as true', async () => {
      const mockUser = { id: 1, groups: [{ id: 1 }] } as User;
      const mockPublicTweetIds = [{ score: 1627553803, item: '1_tweet' }];
      const mockPrivateTweetIds = [{ score: 1627553802, item: '2_tweet' }];
      const mockUserTweetIds = [{ score: 1627553801, item: '3_tweet' }];
      const mockTweets = [
        {
          id: '1',
          content: 'Tweet 1',
          createdAt: new Date(1627553803000),
        } as Tweet,
        {
          id: '2',
          content: 'Tweet 2',
          createdAt: new Date(1627553802000),
        } as Tweet,
        {
          id: '3',
          content: 'Tweet 3',
          createdAt: new Date(1627553801000),
        } as Tweet,
      ];

      jest
        .spyOn(usersService, 'findOneWithRelations')
        .mockResolvedValue(mockUser);

      jest
        .spyOn(cacheService, 'paginatePublicTweetIds')
        .mockResolvedValue(mockPublicTweetIds);

      jest
        .spyOn(cacheService, 'paginatePrivateTweetIds')
        .mockResolvedValue(mockPrivateTweetIds);
      jest
        .spyOn(cacheService, 'paginateUserCreatedTweetIds')
        .mockResolvedValue(mockUserTweetIds);

      jest
        .spyOn(service, 'getCachedTweet')
        .mockResolvedValueOnce(mockTweets[2]);
      jest
        .spyOn(service, 'getCachedTweet')
        .mockResolvedValueOnce(mockTweets[1]);
      jest
        .spyOn(service, 'getCachedTweet')
        .mockResolvedValueOnce(mockTweets[0]);

      const result = await service.paginateTweets(1, 2, 0);

      expect(result.nodes.length).toBe(2);
      expect(result.hasNextPage).toBe(true);
      expect(cacheService.paginatePublicTweetIds).toHaveBeenCalled();
      expect(cacheService.paginatePrivateTweetIds).toHaveBeenCalled();
      expect(cacheService.paginateUserCreatedTweetIds).toHaveBeenCalled();
    });

    it('should throw an error if user is not found', async () => {
      jest.spyOn(usersService, 'findOneWithRelations').mockResolvedValue(null);

      await expect(service.paginateTweets(1, 2, 0)).rejects.toThrow(
        'User not found',
      );
    });

    it('should handle empty tweet cache results gracefully', async () => {
      const mockUser = { id: 1, groups: [{ id: 1 }] } as unknown as User;
      jest
        .spyOn(usersService, 'findOneWithRelations')
        .mockResolvedValue(mockUser);

      jest.spyOn(cacheService, 'paginatePublicTweetIds').mockResolvedValue([]);
      jest.spyOn(cacheService, 'paginatePrivateTweetIds').mockResolvedValue([]);
      jest
        .spyOn(cacheService, 'paginateUserCreatedTweetIds')
        .mockResolvedValue([]);
      jest.spyOn(service, 'getCachedTweet').mockResolvedValue(null);

      const result = await service.paginateTweets(1, 2, 0);

      expect(result.nodes.length).toBe(0);
      expect(result.hasNextPage).toBe(false);
    });

    it('should return valid tweets when cache returns some valid and some null results', async () => {
      const mockUser = { id: 1, groups: [{ id: 1 }] } as unknown as User;
      const mockPublicTweetIds = [{ score: 1627553800, item: '1_tweet' }];
      const mockPrivateTweetIds = [{ score: 1627553800, item: '2_tweet' }];
      const mockUserTweetIds = [{ score: 1627553800, item: '3_tweet' }];
      const mockTweets = [
        { id: '1', content: 'Tweet 1', createdAt: new Date() } as Tweet,
        null, // Simulating a null tweet due to missing cache
        { id: '2', content: 'Tweet 2', createdAt: new Date() } as Tweet,
      ];

      jest
        .spyOn(usersService, 'findOneWithRelations')
        .mockResolvedValue(mockUser);

      jest
        .spyOn(cacheService, 'paginatePublicTweetIds')
        .mockResolvedValue(mockPublicTweetIds);

      jest
        .spyOn(cacheService, 'paginatePrivateTweetIds')
        .mockResolvedValue(mockPrivateTweetIds);
      mockCacheService.paginateUserCreatedTweetIds.mockResolvedValue(
        mockUserTweetIds,
      );
      jest
        .spyOn(service, 'getCachedTweet')
        .mockResolvedValueOnce(mockTweets[0])
        .mockResolvedValueOnce(mockTweets[1])
        .mockResolvedValueOnce(mockTweets[2]);

      const result = await service.paginateTweets(1, 2, 0);

      expect(result.nodes.length).toBe(2);
      expect(result.hasNextPage).toBe(false);
    });

    it('should return tweets with correct pagination', async () => {
      const mockUser = { id: 1, groups: [{ id: 1 }] } as unknown as User;
      const mockPublicTweetIds = [{ score: 1627553801, item: '1_tweet' }];
      const mockPrivateTweetIds = [{ score: 1627553802, item: '2_tweet' }];
      const mockUserTweetIds = [{ score: 1627553803, item: '3_tweet' }];
      const mockTweets = [
        {
          id: '1',
          content: 'Tweet 1',
          createdAt: new Date(1627553801 * 1000),
        } as Tweet,
        {
          id: '2',
          content: 'Tweet 2',
          createdAt: new Date(1627553802 * 1000),
        } as Tweet,
        {
          id: '3',
          content: 'Tweet 3',
          createdAt: new Date(1627553803 * 1000),
        } as Tweet,
      ];

      jest
        .spyOn(usersService, 'findOneWithRelations')
        .mockResolvedValue(mockUser);

      jest
        .spyOn(cacheService, 'paginatePublicTweetIds')
        .mockResolvedValue(mockPublicTweetIds);

      jest
        .spyOn(cacheService, 'paginatePrivateTweetIds')
        .mockResolvedValue(mockPrivateTweetIds);

      jest
        .spyOn(cacheService, 'paginateUserCreatedTweetIds')
        .mockResolvedValue(mockUserTweetIds);

      jest
        .spyOn(service, 'getCachedTweet')
        .mockResolvedValueOnce(mockTweets[2])
        .mockResolvedValueOnce(mockTweets[1])
        .mockResolvedValueOnce(mockTweets[0]);

      const result = await service.paginateTweets(1, 2, 1);

      expect(result.nodes.length).toBe(2); // Paginated to the second page with a limit of 2
      expect(result.hasNextPage).toBe(true); // All tweets fetched
    });
  });

  describe('update', () => {
    // it('should update the tweet and cache it', async () => {
    //   // Mock existing tweet
    //   const existingTweet = {
    //     id: '123',
    //     content: 'Original tweet content',
    //     location: 'Original location',
    //     category: TweetCategory.News,
    //     hashtags: [
    //       { id: '1', name: 'hashtag1', tweets: [], createdAt: new Date() },
    //       { id: '2', name: 'hashtag2', tweets: [], createdAt: new Date() },
    //     ],
    //     author: {
    //       id: 1,
    //       firstName: 'author firstName',
    //       lastName: 'author lastName',
    //       username: 'author',
    //     },
    //   };

    //   // Mock repository methods
    //   const saveTweetMock = jest.fn().mockResolvedValue({
    //     ...existingTweet,
    //     content: 'Updated tweet content',
    //     location: 'Updated location',
    //     hashtags: [
    //       { id: '1', name: 'hashtag1', tweets: [], createdAt: new Date() },
    //       { id: '3', name: 'hashtag3', tweets: [], createdAt: new Date() },
    //     ],
    //   });

    //   const removeHashtagsMock = jest.fn().mockResolvedValue(undefined);

    //   tweetRepository.findOne = jest.fn().mockResolvedValue(existingTweet);
    //   tweetRepository.save = saveTweetMock;
    //   hashtagRepository.remove = removeHashtagsMock;

    //   const updateTweetDto: UpdateTweetDto = {
    //     content: 'Updated tweet content',
    //     location: 'Updated location',
    //     category: TweetCategory.Finance,
    //     hashtags: ['hashtag3'], // new hashtag
    //   };

    //   // Call the update method
    //   const updatedTweet = await service.update('123', updateTweetDto);

    //   // Check that the repository methods were called
    //   expect(tweetRepository.save).toHaveBeenCalledWith(
    //     expect.objectContaining({
    //       id: '123',
    //       content: 'Updated tweet content',
    //       location: 'Updated location',
    //       category: TweetCategory.Finance,
    //       hashtags: expect.arrayContaining([
    //         expect.objectContaining({ name: 'hashtag3' }),
    //       ]),
    //     }),
    //   );

    //   expect(hashtagRepository.remove).toHaveBeenCalledWith([
    //     expect.objectContaining({ name: 'hashtag2' }),
    //   ]);

    //   // Check if the cache was updated
    //   expect(cacheService.cacheTweet).toHaveBeenCalledWith(
    //     updatedTweet.id,
    //     expect.objectContaining({
    //       content: 'Updated tweet content',
    //       location: 'Updated location',
    //       hashtags: expect.arrayContaining([
    //         expect.objectContaining({ name: 'hashtag3' }),
    //       ]),
    //     }),
    //   );
    // });

    it('should throw an error if the tweet does not exist', async () => {
      const updateTweetDto: UpdateTweetDto = {
        content: 'Updated content',
        location: 'Updated location',
        category: TweetCategory.Sport,
        hashtags: ['hashtag1', 'hashtag3'],
      };

      tweetRepository.findOne = jest.fn().mockResolvedValue(null); // Simulate tweet not found

      await expect(service.update('123', updateTweetDto)).rejects.toThrowError(
        'Tweet not found',
      );
    });
  });

  describe('determineTweetVisibility', () => {
    it('should return public visibility if tweet inherits permissions and has no parent', async () => {
      const tweet = {
        inheritViewPermissions: true,
        parentTweet: null,
      } as Tweet;

      const result = await service['determineTweetVisibility'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([0, 'public']);
    });

    it('should recursively determine visibility from parent tweet', async () => {
      // If parentTweet has no parent, but because its inheritViewPermissions is true, even if it has not null viewableGroups it's considered as public
      const parentTweet = {
        inheritViewPermissions: true,
        parentTweet: null,
        viewableGroups: [{ id: 1 }],
      } as Tweet;

      const tweet = {
        inheritViewPermissions: true,
        parentTweet,
      } as Tweet;

      const result = await service['determineTweetVisibility'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([1, 'public']);
    });

    it('should return explicit view permissions for the tweet', async () => {
      const tweet = {
        inheritViewPermissions: false,
      } as Tweet;

      const result = await service['determineTweetVisibility'](
        tweet,
        [1, 2],
        [3, 4],
        0,
      );
      expect(result).toEqual([0, [1, 2], [3, 4]]);
    });

    it('should return private visibility if no permissions are set and inheritance is false', async () => {
      const tweet = {
        inheritViewPermissions: false,
      } as Tweet;

      const result = await service['determineTweetVisibility'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([0, [], []]);
    });

    it('should resolve visibility through a chain of parent tweets test case 1', async () => {
      const grandParentTweet = {
        inheritViewPermissions: true,
        parentTweet: null,
        viewableGroups: [{ id: 1 }],
      } as Tweet;

      const parentTweet = {
        inheritViewPermissions: true,
        parentTweet: grandParentTweet,
        viewableGroups: [{ id: 2 }],
      } as Tweet;

      const tweet = {
        inheritViewPermissions: true,
        parentTweet,
      } as Tweet;

      const result = await service['determineTweetVisibility'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([2, 'public']);
    });

    it('should resolve visibility through a chain of parent tweets test case 2', async () => {
      const grandParentTweet = {
        inheritViewPermissions: false,
        parentTweet: null,
        viewableGroups: [{ id: 1 }],
      } as Tweet;

      const parentTweet = {
        inheritViewPermissions: true,
        parentTweet: grandParentTweet,
        viewableGroups: [{ id: 2 }],
      } as Tweet;

      const tweet = {
        inheritViewPermissions: true,
        parentTweet,
      } as Tweet;

      const result = await service['determineTweetVisibility'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([2, [], [1]]);
    });

    it('should increment depthLevel for each recursive call', async () => {
      const parentTweet = {
        inheritViewPermissions: true,
        parentTweet: null,
      } as Tweet;

      const tweet = {
        inheritViewPermissions: true,
        parentTweet,
      } as Tweet;

      const result = await service['determineTweetVisibility'](
        tweet,
        [],
        [],
        5,
      );
      expect(result).toEqual([6, 'public']);
    });
  });

  describe('updateTweetPermissions', () => {
    it('should throw an error if the tweet is not found', async () => {
      jest.spyOn(tweetRepository, 'findOne').mockResolvedValueOnce(null);

      const dto: UpdateTweetPermissionsDto = {
        viewPermissionsUserIds: [],
        editPermissionsUserIds: [],
        viewPermissionsGroupIds: [],
        editPermissionsGroupIds: [],
        inheritViewPermissions: false,
        inheritEditPermissions: false,
      };

      await expect(
        service.updateTweetPermissions('non-existent-id', dto, 1),
      ).rejects.toThrow('Tweet not found');
    });

    it('should throw an error if the user is not the author of the tweet', async () => {
      jest.spyOn(tweetRepository, 'findOne').mockResolvedValueOnce({
        id: 'tweet123',
        author: { id: 2 },
      } as Tweet);

      const dto: UpdateTweetPermissionsDto = {
        viewPermissionsUserIds: [],
        editPermissionsUserIds: [],
        viewPermissionsGroupIds: [],
        editPermissionsGroupIds: [],
        inheritViewPermissions: false,
        inheritEditPermissions: false,
      };

      await expect(
        service.updateTweetPermissions('tweet123', dto, 1),
      ).rejects.toThrow('You are not the author of this tweet');
    });

    it('should update permissions for a public viewable and editable tweet', async () => {
      const tweet = {
        id: 'tweet123',
        author: { id: 1 },
        hashtags: [{ name: 'hashtag1' }],
        category: 'category1',
        createdAt: new Date(1699118400000),
        inheritViewPermissions: false,
        inheritEditPermissions: false,
        viewableGroups: [],
        editableGroups: [],
      } as unknown as Tweet;

      const dto: UpdateTweetPermissionsDto = {
        viewPermissionsUserIds: [],
        editPermissionsUserIds: [],
        viewPermissionsGroupIds: [],
        editPermissionsGroupIds: [],
        inheritViewPermissions: true,
        inheritEditPermissions: true,
      };

      jest.spyOn(tweetRepository, 'findOne').mockResolvedValueOnce(tweet);
      service.determineTweetVisibility = jest
        .fn()
        .mockResolvedValue([0, 'public']);
      service.determineTweetEditability = jest
        .fn()
        .mockResolvedValue([0, 'public']);
      jest.spyOn(tweetRepository, 'save').mockResolvedValueOnce(tweet);

      jest
        .spyOn(cacheService, 'addPublicViewableTweetToZSet')
        .mockResolvedValueOnce();

      const updatedTweet = await service.updateTweetPermissions(
        'tweet123',
        dto,
        1,
      );

      expect(updatedTweet.inheritViewPermissions).toBe(true);
      expect(updatedTweet.inheritEditPermissions).toBe(true);

      // Verify CacheService for public viewable and editable tweets
      expect(cacheService.addPublicViewableTweetToZSet).toHaveBeenCalledWith(
        'tweet123',
        ['hashtag1'],
        'category1',
        1699118400,
      );
      expect(cacheService.setTweetIsPublicEditable).toHaveBeenCalledWith(
        'tweet123',
      );
    });

    it('should update permissions for a private viewable and editable tweet', async () => {
      const tweet = {
        id: 'tweet456',
        author: { id: 1 },
        hashtags: [{ name: 'hashtag1' }],
        category: 'category2',
        createdAt: new Date(1699118400000),
        inheritViewPermissions: false,
        inheritEditPermissions: false,
        viewableGroups: [],
        editableGroups: [],
      } as unknown as Tweet;

      const group1 = { id: 1 } as Group;
      const group2 = { id: 2 } as Group;

      const dto: UpdateTweetPermissionsDto = {
        viewPermissionsUserIds: [3],
        editPermissionsUserIds: [4],
        viewPermissionsGroupIds: [1],
        editPermissionsGroupIds: [2],
        inheritViewPermissions: false,
        inheritEditPermissions: false,
      };

      jest.spyOn(tweetRepository, 'findOne').mockResolvedValueOnce(tweet);
      service.determineTweetVisibility = jest
        .fn()
        .mockResolvedValue([0, [3], [1]]);
      service.determineTweetEditability = jest
        .fn()
        .mockResolvedValue([0, [4], [2]]);
      service['assignGroupsToUsers'] = jest
        .fn()
        .mockResolvedValue([group1, group2]);
      jest.spyOn(tweetRepository, 'save').mockResolvedValueOnce(tweet);

      const updatedTweet = await service.updateTweetPermissions(
        'tweet456',
        dto,
        1,
      );

      // Verify groups assigned
      expect(updatedTweet.viewableGroups).toEqual([group1, group2]);
      expect(updatedTweet.editableGroups).toEqual([group1, group2]);

      // Verify CacheService for private viewable and editable tweets
      expect(cacheService.addPrivateViewableTweetToZSet).toHaveBeenCalledWith(
        group1.id,
        'tweet456',
        ['hashtag1'],
        'category2',
        1699118400,
      );
      expect(cacheService.addPrivateViewableTweetToZSet).toHaveBeenCalledWith(
        group2.id,
        'tweet456',
        ['hashtag1'],
        'category2',
        1699118400,
      );

      expect(cacheService.setTweetIsEditableByGroup).toHaveBeenCalledWith(
        'tweet456',
        group1.id,
      );
      expect(cacheService.setTweetIsEditableByGroup).toHaveBeenCalledWith(
        'tweet456',
        group2.id,
      );
    });
  });

  describe('determineTweetEditability', () => {
    it('should return public visibility if tweet inherits permissions and has no parent', async () => {
      const tweet = {
        inheritEditPermissions: true,
        parentTweet: null,
      } as Tweet;

      const result = await service['determineTweetEditability'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([0, 'public']);
    });

    it('should recursively determine editability from parent tweet', async () => {
      // If parentTweet has no parent, but because its inheritEditPermissions is true, even if it has not null editableGroups it's considered as public
      const parentTweet = {
        inheritEditPermissions: true,
        parentTweet: null,
        editableGroups: [{ id: 1 }],
      } as Tweet;

      const tweet = {
        inheritEditPermissions: true,
        parentTweet,
      } as Tweet;

      const result = await service['determineTweetEditability'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([1, 'public']);
    });

    it('should return explicit edit permissions for the tweet', async () => {
      const tweet = {
        inheritEditPermissions: false,
      } as Tweet;

      const result = await service['determineTweetEditability'](
        tweet,
        [1, 2],
        [3, 4],
        0,
      );
      expect(result).toEqual([0, [1, 2], [3, 4]]);
    });

    it('should return private editability if no permissions are set and inheritance is false', async () => {
      const tweet = {
        inheritEditPermissions: false,
      } as Tweet;

      const result = await service['determineTweetEditability'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([0, [], []]);
    });

    it('should resolve editability through a chain of parent tweets test case 1', async () => {
      const grandParentTweet = {
        inheritEditPermissions: true,
        parentTweet: null,
        editableGroups: [{ id: 1 }],
      } as Tweet;

      const parentTweet = {
        inheritEditPermissions: true,
        parentTweet: grandParentTweet,
        editableGroups: [{ id: 2 }],
      } as Tweet;

      const tweet = {
        inheritEditPermissions: true,
        parentTweet,
      } as Tweet;

      const result = await service['determineTweetEditability'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([2, 'public']);
    });

    it('should resolve editability through a chain of parent tweets test case 2', async () => {
      const grandParentTweet = {
        inheritEditPermissions: false,
        parentTweet: null,
        editableGroups: [{ id: 1 }],
      } as Tweet;

      const parentTweet = {
        inheritEditPermissions: true,
        parentTweet: grandParentTweet,
        editableGroups: [{ id: 2 }],
      } as Tweet;

      const tweet = {
        inheritEditPermissions: true,
        parentTweet,
      } as Tweet;

      const result = await service['determineTweetEditability'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([2, [], [1]]);
    });

    it('should increment depthLevel for each recursive call', async () => {
      const parentTweet = {
        inheritEditPermissions: true,
        parentTweet: null,
      } as Tweet;

      const tweet = {
        inheritEditPermissions: true,
        parentTweet,
      } as Tweet;

      const result = await service['determineTweetEditability'](
        tweet,
        [],
        [],
        5,
      );
      expect(result).toEqual([6, 'public']);
    });
  });

  describe('assignGroupsToUsers', () => {
    it('should return valid user groups that match the given userIds', async () => {
      const userIds = [1, 2];
      const groupIds = [];
      const authorId = 10;

      const matchingGroup = {
        id: 1,
        users: [{ id: 1 }, { id: 2 }],
      };
      mockGroupsService.findUserGroupsByUserIds.mockResolvedValueOnce([
        matchingGroup,
      ]);
      mockGroupsService.findGroupsByIds.mockResolvedValueOnce([]);

      const result = await service['assignGroupsToUsers'](
        userIds,
        groupIds,
        authorId,
      );

      expect(result).toEqual([matchingGroup]);
      expect(mockGroupsService.findUserGroupsByUserIds).toHaveBeenCalledWith(
        userIds,
        authorId,
      );
      expect(mockGroupsService.findGroupsByIds).toHaveBeenCalledWith(groupIds);
    });

    it('should create a new group if no valid user groups exist', async () => {
      const userIds = [1, 2];
      const groupIds = [];
      const authorId = 10;

      const newGroup = {
        id: 2,
        users: [{ id: 1 }, { id: 2 }],
      };

      mockGroupsService.findUserGroupsByUserIds.mockResolvedValueOnce([]);
      mockGroupsService.findGroupsByIds.mockResolvedValueOnce([]);
      mockGroupsService.create.mockResolvedValueOnce(newGroup);

      const result = await service['assignGroupsToUsers'](
        userIds,
        groupIds,
        authorId,
      );

      expect(result).toEqual([newGroup]);
      expect(mockGroupsService.create).toHaveBeenCalledWith({
        name: 'groupOfUsers',
        userIds,
        creatorId: authorId,
        parentGroupId: null,
      });
    });

    it('should combine valid user groups and explicitly provided groups, avoiding duplicates', async () => {
      const userIds = [1, 2];
      const groupIds = [3];
      const authorId = 10;

      const matchingGroup = {
        id: 1,
        users: [{ id: 1 }, { id: 2 }],
      };
      const explicitGroup = {
        id: 3,
        users: [{ id: 3 }],
      };

      mockGroupsService.findUserGroupsByUserIds.mockResolvedValueOnce([
        matchingGroup,
      ]);
      mockGroupsService.findGroupsByIds.mockResolvedValueOnce([explicitGroup]);

      const result = await service['assignGroupsToUsers'](
        userIds,
        groupIds,
        authorId,
      );

      expect(result).toEqual([matchingGroup, explicitGroup]);
      expect(mockGroupsService.findUserGroupsByUserIds).toHaveBeenCalledWith(
        userIds,
        authorId,
      );
      expect(mockGroupsService.findGroupsByIds).toHaveBeenCalledWith(groupIds);
    });

    it('should create a new group if existing groups do not match the userIds', async () => {
      const userIds = [1, 2];
      const groupIds = [];
      const authorId = 10;

      const nonMatchingGroup = {
        id: 1,
        users: [{ id: 1 }, { id: 3 }],
      };
      const newGroup = {
        id: 2,
        users: [{ id: 1 }, { id: 2 }],
      };

      mockGroupsService.findUserGroupsByUserIds.mockResolvedValueOnce([
        nonMatchingGroup,
      ]);
      mockGroupsService.findGroupsByIds.mockResolvedValueOnce([]);
      mockGroupsService.create.mockResolvedValueOnce(newGroup);

      const result = await service['assignGroupsToUsers'](
        userIds,
        groupIds,
        authorId,
      );

      expect(result).toEqual([newGroup]);
      expect(mockGroupsService.create).toHaveBeenCalledWith({
        name: 'groupOfUsers',
        userIds,
        creatorId: authorId,
        parentGroupId: null,
      });
    });

    it('should create a new group if an existing group has additional users beyond the given userIds', async () => {
      const userIds = [1, 2];
      const groupIds = [];
      const authorId = 10;

      const groupWithExtraUser = {
        id: 1,
        users: [{ id: 1 }, { id: 2 }, { id: 3 }], // Extra user with id 3
      };
      const newGroup = {
        id: 2,
        users: [{ id: 1 }, { id: 2 }],
      };

      mockGroupsService.findUserGroupsByUserIds.mockResolvedValueOnce([
        groupWithExtraUser,
      ]);
      mockGroupsService.findGroupsByIds.mockResolvedValueOnce([]);
      mockGroupsService.create.mockResolvedValueOnce(newGroup);

      const result = await service['assignGroupsToUsers'](
        userIds,
        groupIds,
        authorId,
      );

      expect(result).toEqual([newGroup]);
      expect(mockGroupsService.findUserGroupsByUserIds).toHaveBeenCalledWith(
        userIds,
        authorId,
      );
      expect(mockGroupsService.create).toHaveBeenCalledWith({
        name: 'groupOfUsers',
        userIds,
        creatorId: authorId,
        parentGroupId: null,
      });
    });
  });

  describe('canEdit', () => {
    it('should return true for the author', async () => {
      jest.spyOn(tweetRepository, 'findOne').mockResolvedValue(mockTweet);
      jest
        .spyOn(usersService, 'findOneWithRelations')
        .mockResolvedValue(mockUser2);

      // User id is 1 and also author id of the mocked tweet is one
      const result = await service.canEdit(2, '1');

      expect(result).toBe(true);
    });

    it('should return true if the tweet is public editable', async () => {
      jest
        .spyOn(service, 'determineTweetEditability')
        .mockResolvedValue([0, 'public']);

      const mockTweet = {
        id: '1',
        editableGroups: [],
        author: mockUser2,
      };
      const mockUser = { id: 1, groups: [] };

      mockTweetRepository.findOne.mockResolvedValue(mockTweet);
      mockUsersService.findOneWithRelations.mockResolvedValue(mockUser);

      const result = await service.canEdit(1, '1');

      expect(result).toBe(true);
      expect(mockTweetRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['author', 'hashtags', 'parentTweet', 'editableGroups'],
      });
      expect(mockUsersService.findOneWithRelations).toHaveBeenCalledWith(1, [
        'groups',
      ]);
    });
    it('should return true if the tweet is public editable', async () => {
      jest
        .spyOn(service, 'determineTweetEditability')
        .mockResolvedValue([0, 'public']);

      const mockTweet = {
        id: '1',
        author: mockUser2,
        editableGroups: [],
      };
      const mockUser = { id: 1, groups: [] };

      mockTweetRepository.findOne.mockResolvedValue(mockTweet);
      mockUsersService.findOneWithRelations.mockResolvedValue(mockUser);

      const result = await service.canEdit(1, '1');

      expect(result).toBe(true);
      expect(mockTweetRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['author', 'hashtags', 'parentTweet', 'editableGroups'],
      });
      expect(mockUsersService.findOneWithRelations).toHaveBeenCalledWith(1, [
        'groups',
      ]);
    });

    it('should return true if the user belongs to the allowed groups', async () => {
      const mockTweet = {
        id: '1',
        author: mockUser2,
        editableGroups: [{ id: 1 }],
      };
      const mockUser = { id: 1, groups: [{ id: 1 }] };

      jest
        .spyOn(service, 'determineTweetEditability')
        .mockResolvedValue([3, [], [1]]);

      mockTweetRepository.findOne.mockResolvedValue(mockTweet);
      mockUsersService.findOneWithRelations.mockResolvedValue(mockUser);
      mockUsersService.isUserInGroupIds.mockResolvedValue(true);

      const result = await service.canEdit(1, '1');

      expect(result).toBe(true);
      expect(mockTweetRepository.findOne).toHaveBeenCalled();
      expect(mockUsersService.findOneWithRelations).toHaveBeenCalled();
      expect(mockUsersService.isUserInGroupIds).toHaveBeenCalledWith(mockUser, [
        1,
      ]);
    });

    it('should return false if the user does not belong to the allowed groups', async () => {
      const mockTweet = {
        id: '1',
        author: mockUser2,
        editableGroups: [{ id: 2 }],
      };
      const mockUser = { id: 1, groups: [{ id: 3 }] };

      jest
        .spyOn(tweetRepository, 'findOne')
        .mockResolvedValue(mockTweet as Tweet);
      jest
        .spyOn(usersService, 'findOneWithRelations')
        .mockResolvedValue(mockUser as User);

      mockUsersService.isUserInGroupIds.mockResolvedValue(false);

      const result = await service.canEdit(1, '1');

      expect(result).toBe(false);
    });

    it('should throw an error if the user is not found', async () => {
      mockTweetRepository.findOne.mockResolvedValue({});
      mockUsersService.findOneWithRelations.mockResolvedValue(null);

      await expect(service.canEdit(1, '1')).rejects.toThrow('User not found');
    });

    it('should throw an error if the tweet is not found', async () => {
      mockTweetRepository.findOne.mockResolvedValue(null);
      mockUsersService.findOneWithRelations.mockResolvedValue({});

      await expect(service.canEdit(1, '1')).rejects.toThrow('Tweet not found');
    });
  });

  describe('remove', () => {
    it('should delete a tweet by ID', async () => {
      const tweet = { id: '1', content: 'Hello' } as Tweet;

      jest.spyOn(tweetRepository, 'findOne').mockResolvedValueOnce(tweet);
      jest.spyOn(tweetRepository, 'remove').mockResolvedValueOnce(undefined);

      await service.remove('1');

      expect(tweetRepository.remove).toHaveBeenCalledWith(tweet);
    });
  });
});
