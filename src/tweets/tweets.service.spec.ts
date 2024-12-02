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
      const createTweetDto: CreateTweetDto = {
        content: 'Hello, World!',
        authorId: 1,
        parentTweetId: null,
        hashtags: ['#greeting', '#welcome'],
        location: 'Earth',
        category: TweetCategory.News,
      };

      const mockAuthor = new User();
      mockAuthor.id = 1;

      const mockHashtags = [{ id: 1, name: '#greeting' } as unknown as Hashtag];
      const newHashtag = { id: 2, name: '#welcome' } as unknown as Hashtag;

      const savedTweet = new Tweet();
      savedTweet.id = '1';
      savedTweet.content = createTweetDto.content;
      savedTweet.author = mockAuthor;
      savedTweet.hashtags = [mockHashtags[0], newHashtag];

      mockUsersService.findOne.mockResolvedValue(mockAuthor);
      mockHashtagRepository.findBy.mockResolvedValue(mockHashtags);
      mockHashtagRepository.create.mockReturnValue(newHashtag);
      mockHashtagRepository.save.mockResolvedValue(newHashtag);
      mockTweetRepository.save.mockResolvedValue(savedTweet);
      const mockCacheTweet = jest
        .spyOn(service, 'cacheTweet')
        .mockResolvedValue();

      const result = await service.create(createTweetDto);

      expect(usersService.findOne).toHaveBeenCalledWith(
        createTweetDto.authorId,
      );
      expect(hashtagRepository.findBy).toHaveBeenCalledWith({
        name: In(expect.any(Array)),
      });
      expect(hashtagRepository.create).toHaveBeenCalledWith({
        name: expect.any(String),
      });
      expect(hashtagRepository.save).toHaveBeenCalled();
      expect(tweetRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          content: createTweetDto.content,
          author: mockAuthor,
          hashtags: [mockHashtags[0], newHashtag],
        }),
      );
      expect(mockCacheTweet).toHaveBeenCalledWith(savedTweet);
      expect(result).toEqual(savedTweet);
    });

    it('should throw an error if the author is not found', async () => {
      const createTweetDto: CreateTweetDto = {
        content: 'Hello, World!',
        authorId: 1,
        parentTweetId: null,
        hashtags: ['#greeting', '#welcome'],
        location: 'Earth',
        category: TweetCategory.News,
      };

      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      await expect(service.create(createTweetDto)).rejects.toThrow(
        'User not found',
      );
      expect(mockUsersService.findOne).toHaveBeenCalledWith(
        createTweetDto.authorId,
      );
    });

    it('should throw an error if the parent tweet is not found', async () => {
      const createTweetDto: CreateTweetDto = {
        content: 'Hello, World!',
        authorId: 1,
        parentTweetId: '100',
        hashtags: ['#greeting', '#welcome'],
        location: 'Earth',
        category: TweetCategory.News,
      };

      const mockAuthor = new User();
      mockAuthor.id = 1;

      mockUsersService.findOne.mockResolvedValue(mockAuthor);
      mockTweetRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createTweetDto)).rejects.toThrow(
        'Parent tweet not found',
      );

      expect(mockUsersService.findOne).toHaveBeenCalledWith(
        createTweetDto.authorId,
      );
      expect(mockTweetRepository.findOne).toHaveBeenCalledWith({
        where: { id: createTweetDto.parentTweetId },
      });
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
    it('should throw an error if the user is not found', async () => {
      jest
        .spyOn(mockUsersService, 'findOneWithRelations')
        .mockResolvedValue(null);

      await expect(service.paginateTweets(123, 10, 1)).rejects.toThrowError(
        'User not found',
      );
    });

    it('should return paginated tweets successfully', async () => {
      jest
        .spyOn(mockUsersService, 'findOneWithRelations')
        .mockResolvedValue(mockUser);

      jest
        .spyOn(mockCacheService, 'paginatePublicTweetIds')
        .mockResolvedValue([{ score: 1000, item: 'tweet_1' }]);

      jest
        .spyOn(mockCacheService, 'paginatePrivateTweetIds')
        .mockResolvedValue([{ score: 900, item: 'tweet_2' }]);

      jest
        .spyOn(service, 'getCachedTweet')
        .mockResolvedValueOnce(mockTweet)
        .mockResolvedValueOnce(null); // Simulate a missing cached tweet

      const result = await service.paginateTweets(1, 2, 1);

      expect(result).toEqual({
        nodes: [mockTweet],
        hasNextPage: false,
      });

      expect(mockUsersService.findOneWithRelations).toHaveBeenCalledWith(1, [
        'groups',
      ]);
      expect(mockCacheService.paginatePublicTweetIds).toHaveBeenCalled();
      expect(mockCacheService.paginatePrivateTweetIds).toHaveBeenCalled();
      expect(service.getCachedTweet).toHaveBeenCalledTimes(2);
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
