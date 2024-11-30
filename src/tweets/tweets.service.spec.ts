import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

const mockTweetRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

const mockUserRepository = {
  findOne: jest.fn(),
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
  addPublicViewableTweetToZSet: jest.fn(),
  addPrivateViewableTweetToZSet: jest.fn(),
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
  isUserInGroupIds: jest.fn(),
};

const mockTweet = {
  id: '1',
  content: 'Test tweet',
  author: { id: 1 },
  editableGroups: [{ id: 1 }, { id: 2 }],
  parentTweet: null,
  hashtags: [],
} as Tweet;

const mockUser = {
  id: 1,
  name: 'Test User',
  groups: [{ id: 1 }],
} as unknown as User;

describe('TweetsService', () => {
  let service: TweetsService;
  let tweetRepository: Repository<Tweet>;
  let userRepository: Repository<User>;
  let hashtagRepository: Repository<Hashtag>;
  let cacheService: CacheService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TweetsService,
        {
          provide: getRepositoryToken(Tweet),
          useValue: mockTweetRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
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
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
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
    it('should create a tweet and cache it', async () => {
      const createTweetDto = {
        content: 'Test tweet content',
        authorId: 1,
        parentTweetId: null,
        hashtags: ['hashtag1', 'hashtag2'],
        location: 'Test location',
        category: TweetCategory.News,
      };

      const author = {
        id: 1,
        username: 'author',
        firstName: 'author firstName',
        lastName: 'author lastName',
      } as unknown as User;

      const savedTweet = new Tweet();
      savedTweet.id = '123';
      savedTweet.content = createTweetDto.content;
      savedTweet.author = author;
      savedTweet.hashtags = [
        {
          name: 'hashtag1',
          id: '',
          tweets: [],
          createdAt: undefined,
        },
        {
          name: 'hashtag2',
          id: '',
          tweets: [],
          createdAt: undefined,
        },
      ];
      savedTweet.location = createTweetDto.location;
      savedTweet.category = createTweetDto.category;

      // Mock repositories
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(author as User);
      jest.spyOn(tweetRepository, 'save').mockResolvedValue(savedTweet);

      // Mock cache service's cacheTweet method
      const cacheTweetSpy = jest
        .spyOn(cacheService, 'cacheTweet')
        .mockResolvedValue();

      // Mock protobuf.load for serialization
      const mockedProtoPath = path.join(__dirname, 'tweet.proto');
      const mockedTweetProto = {
        lookupType: jest.fn().mockReturnValue({
          encode: jest.fn().mockReturnValue({
            finish: jest.fn().mockReturnValue(Buffer.from('serializedData')),
          }),
        }),
      };
      jest.spyOn(protobuf, 'load').mockResolvedValue(mockedTweetProto as any);

      // Call create method
      const result = await service.create(createTweetDto);

      // Assertions
      expect(result).toEqual(savedTweet);
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(tweetRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ content: createTweetDto.content }),
      );
      expect(cacheTweetSpy).toHaveBeenCalledWith(
        savedTweet.id,
        expect.any(String),
      );
      expect(protobuf.load).toHaveBeenCalledWith(mockedProtoPath);
      expect(mockedTweetProto.lookupType).toHaveBeenCalledWith('Tweet');
      expect(mockedTweetProto.lookupType().encode).toHaveBeenCalledWith({
        id: savedTweet.id,
        content: savedTweet.content,
        authorId: savedTweet.author.id,
        hashtags: savedTweet.hashtags.map((h) => h.name),
        location: savedTweet.location,
        category: savedTweet.category,
      });
    });

    it('should throw an error if author is not found', async () => {
      const createTweetDto = {
        content: 'Test tweet content',
        authorId: 999, // Non-existing author
        parentTweetId: null,
        hashtags: ['hashtag1'],
        location: 'Test location',
        category: TweetCategory.Finance,
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null); // Simulate author not found

      await expect(service.create(createTweetDto)).rejects.toThrowError(
        'User not found',
      );
    });

    it('should throw an error if parent tweet is not found', async () => {
      const createTweetDto = {
        content: 'Test tweet content',
        authorId: 1,
        parentTweetId: '999', // Non-existing parent tweet
        hashtags: ['hashtag1'],
        location: 'Test location',
        category: TweetCategory.Sport,
      };

      const author = { id: 1, username: 'author' };
      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue(author as unknown as User);
      jest.spyOn(tweetRepository, 'findOne').mockResolvedValue(null); // Simulate parent tweet not found

      await expect(service.create(createTweetDto)).rejects.toThrowError(
        'Parent tweet not found',
      );
    });
  });

  describe('cacheTweet', () => {
    it('should serialize the tweet and call cacheTweet method in CacheService', async () => {
      const tweetId = '123';

      // Mock Tweet object
      const tweet = {
        id: tweetId,
        content: 'Test content',
        author: { id: 1, username: 'author' },
        hashtags: [{ name: 'hashtag1' }, { name: 'hashtag2' }],
        location: 'Test location',
        category: 'Test category',
      } as any;

      // Mock the protobuf.load and protobuf.encode calls
      const mockedProtoPath = path.join(__dirname, 'tweet.proto');
      const mockedTweetProto = {
        lookupType: jest.fn().mockReturnValue({
          encode: jest.fn().mockReturnValue({
            finish: jest.fn().mockReturnValue(Buffer.from('serializedData')),
          }),
        }),
      };

      // Mock protobuf.load to return the mockedTweetProto
      jest.spyOn(protobuf, 'load').mockResolvedValue(mockedTweetProto as any);

      // Mock cacheService.cacheTweet to track calls
      const cacheTweetSpy = jest.spyOn(cacheService, 'cacheTweet');

      // Call the cacheTweet method
      await service.cacheTweet(tweetId, tweet);

      // Assertions
      expect(protobuf.load).toHaveBeenCalledWith(mockedProtoPath);
      expect(mockedTweetProto.lookupType).toHaveBeenCalledWith('Tweet');
      expect(cacheTweetSpy).toHaveBeenCalledWith(tweetId, 'serializedData');
    });

    it('should throw an error if protobuf.load fails', async () => {
      const tweetId = '123';
      const tweet = {
        id: tweetId,
        content: 'Test content',
        author: { id: 1, username: 'author' },
        hashtags: [{ name: 'hashtag1' }],
        location: 'Test location',
        category: 'Test category',
      } as any;

      // Simulate protobuf.load failure
      jest
        .spyOn(protobuf, 'load')
        .mockRejectedValue(new Error('Proto file not found'));

      await expect(service.cacheTweet(tweetId, tweet)).rejects.toThrowError(
        'Proto file not found',
      );
    });

    it('should throw an error if CacheService.cacheTweet fails', async () => {
      const tweetId = '123';
      const tweet = {
        id: tweetId,
        content: 'Test content',
        author: { id: 1, username: 'author' },
        hashtags: [{ name: 'hashtag1' }],
        location: 'Test location',
        category: 'Test category',
      } as any;

      // Mock successful protobuf loading and encoding
      const mockedTweetProto = {
        lookupType: jest.fn().mockReturnValue({
          encode: jest.fn().mockReturnValue({
            finish: jest.fn().mockReturnValue(Buffer.from('serializedData')),
          }),
        }),
      };

      // Mock protobuf.load to return the mockedTweetProto
      jest.spyOn(protobuf, 'load').mockResolvedValue(mockedTweetProto as any);

      // Mock CacheService to throw an error on set
      const cacheTweetSpy = jest
        .spyOn(cacheService, 'cacheTweet')
        .mockRejectedValue(new Error('Cache service failed'));

      await expect(service.cacheTweet(tweetId, tweet)).rejects.toThrowError(
        'Cache service failed',
      );
      expect(cacheTweetSpy).toHaveBeenCalledWith(tweetId, 'serializedData');
    });
  });

  describe('update', () => {
    // it('should update a tweet and manage hashtags', async () => {
    //   const updateTweetDto: UpdateTweetDto = {
    //     content: 'Updated content',
    //     hashtags: ['nestjs', 'javascript'], // Updated hashtags
    //   };

    //   const author = {
    //     id: '1',
    //     firstName: 'Test User firstName',
    //     lastName: 'Test User lastName',
    //   } as unknown as User;

    //   const tweet = {
    //     id: '1',
    //     content: 'Old content',
    //     author: author,
    //     hashtags: [
    //       { id: '1', name: 'nestjs', tweets: [], createdAt: new Date() },
    //     ] as Hashtag[],
    //   } as Tweet;

    //   const existingHashtags = [
    //     { id: '1', name: 'nestjs', tweets: [], createdAt: new Date() },
    //   ] as Hashtag[];

    //   const newHashtag = {
    //     id: '2',
    //     name: 'javascript',
    //     tweets: [],
    //     createdAt: new Date(),
    //   } as Hashtag;

    //   jest.spyOn(tweetRepository, 'findOne').mockResolvedValueOnce(tweet);
    //   jest
    //     .spyOn(hashtagRepository, 'findBy')
    //     .mockResolvedValueOnce(existingHashtags);
    //   jest.spyOn(hashtagRepository, 'save').mockResolvedValueOnce(newHashtag);
    //   jest.spyOn(tweetRepository, 'save').mockResolvedValueOnce({
    //     ...tweet,
    //     ...updateTweetDto,
    //     hashtags: [...existingHashtags, newHashtag],
    //   });
    //   jest.spyOn(cacheService, 'setValue').mockResolvedValueOnce();

    //   const result = await service.update('1', updateTweetDto);

    //   expect(result).toEqual({
    //     ...tweet,
    //     ...updateTweetDto,
    //     hashtags: [...existingHashtags, newHashtag],
    //   });
    //   expect(tweetRepository.save).toHaveBeenCalledWith(expect.any(Tweet));
    //   expect(tweetRepository.save).toHaveBeenCalledWith(
    //     expect.objectContaining({
    //       content: 'Updated content',
    //       hashtags: [
    //         expect.objectContaining({ id: '1', name: 'nestjs' }),
    //         expect.objectContaining({ id: '2', name: 'javascript' }),
    //       ],
    //     }),
    //   );
    //   expect(hashtagRepository.save).toHaveBeenCalledWith(
    //     expect.objectContaining({ id: '2', name: 'javascript' }),
    //   );

    //   expect(cacheService.setValue).toHaveBeenCalledWith(
    //     `cache:tweet:${result.id}`,
    //     expect.any(String),
    //   );
    // });

    it('should throw an error if the tweet does not exist', async () => {
      const updateTweetDto: UpdateTweetDto = { content: 'Updated content' };

      jest.spyOn(tweetRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(service.update('999', updateTweetDto)).rejects.toThrow(
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

    it('should return public visibility if no permissions are set and inheritance is false', async () => {
      const tweet = {
        inheritViewPermissions: false,
      } as Tweet;

      const result = await service['determineTweetVisibility'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([0, 'public']);
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
        1699118400000,
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
        1699118400000,
      );
      expect(cacheService.addPrivateViewableTweetToZSet).toHaveBeenCalledWith(
        group2.id,
        'tweet456',
        ['hashtag1'],
        'category2',
        1699118400000,
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

    it('should return public editability if no permissions are set and inheritance is false', async () => {
      const tweet = {
        inheritEditPermissions: false,
      } as Tweet;

      const result = await service['determineTweetEditability'](
        tweet,
        [],
        [],
        0,
      );
      expect(result).toEqual([0, 'public']);
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
    it('should throw an error if tweet is not found', async () => {
      mockTweetRepository.findOne.mockResolvedValueOnce(null);
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);

      await expect(service.canEdit(mockUser.id, mockTweet.id)).rejects.toThrow(
        'Tweet not found',
      );

      expect(tweetRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTweet.id },
        relations: ['author', 'hashtags', 'parentTweet', 'editableGroups'],
      });
    });

    it('should throw an error if user is not found', async () => {
      mockTweetRepository.findOne.mockResolvedValueOnce(mockTweet);
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.canEdit(mockUser.id, mockTweet.id)).rejects.toThrow(
        'User not found',
      );

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should return true if tweet is public editable', async () => {
      mockTweetRepository.findOne.mockResolvedValueOnce(mockTweet);
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      jest
        .spyOn(service, 'determineTweetEditability')
        .mockResolvedValueOnce([0, 'public']);

      const result = await service.canEdit(mockUser.id, mockTweet.id);

      expect(result).toBe(true);
      expect(tweetRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTweet.id },
        relations: ['author', 'hashtags', 'parentTweet', 'editableGroups'],
      });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(service.determineTweetEditability).toHaveBeenCalled();
    });

    it('should return true if user is in allowed groups', async () => {
      mockTweetRepository.findOne.mockResolvedValueOnce(mockTweet);
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      jest
        .spyOn(service, 'determineTweetEditability')
        .mockResolvedValueOnce([0, [], [1, 2]]);
      mockUsersService.isUserInGroupIds.mockResolvedValueOnce(true);

      const result = await service.canEdit(mockUser.id, mockTweet.id);

      expect(result).toBe(true);
      expect(usersService.isUserInGroupIds).toHaveBeenCalledWith(
        mockUser,
        [1, 2],
      );
    });

    it('should return false if user is not in allowed groups', async () => {
      mockTweetRepository.findOne.mockResolvedValueOnce(mockTweet);
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      jest
        .spyOn(service, 'determineTweetEditability')
        .mockResolvedValueOnce([0, [], [1, 2]]);
      mockUsersService.isUserInGroupIds.mockResolvedValueOnce(false);

      const result = await service.canEdit(mockUser.id, mockTweet.id);

      expect(result).toBe(false);
      expect(usersService.isUserInGroupIds).toHaveBeenCalledWith(
        mockUser,
        [1, 2],
      );
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
