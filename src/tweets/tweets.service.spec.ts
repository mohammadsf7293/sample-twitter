import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TweetsService } from './tweets.service';
import { Tweet, TweetCategory } from './tweet.entity';
import { User } from '../users/user.entity';
import { Hashtag } from './hashtag.entity';
import { CreateTweetDto } from './dto/create-tweet.dto';
import { UpdateTweetDto } from './dto/update-tweet.dto';
import { CacheService } from '../cache/cache.service';
import { GroupsService } from '../groups/groups.service';

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
};

const mockGroupsService = {
  findUserGroupsByUserIds: jest.fn(),
  findGroupsByIds: jest.fn(),
  create: jest.fn(),
};

describe('TweetsService', () => {
  let service: TweetsService;
  let tweetRepository: Repository<Tweet>;
  let userRepository: Repository<User>;
  let hashtagRepository: Repository<Hashtag>;
  let cacheService: CacheService;

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
      ],
    }).compile();

    service = module.get<TweetsService>(TweetsService);
    tweetRepository = module.get<Repository<Tweet>>(getRepositoryToken(Tweet));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    hashtagRepository = module.get<Repository<Hashtag>>(
      getRepositoryToken(Hashtag),
    );
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new tweet and store serialized tweet in Redis', async () => {
      const createTweetDto: CreateTweetDto = {
        content: 'Hello, world!',
        authorId: 1,
        parentTweetId: null,
        hashtags: ['nestjs', 'typescript'],
        location: 'Earth',
        category: TweetCategory.Tech,
      };

      const author = {
        id: '1',
        firstName: 'Test User firstName',
        lastName: 'Test User lastName',
      } as unknown as User;
      const newHashtag = { id: '2', name: 'typescript' } as Hashtag;
      const existingHashtags = [
        { id: '1', name: 'nestjs' } as Hashtag,
      ] as Hashtag[];

      const createdTweet = {
        id: '1',
        ...createTweetDto,
        hashtags: existingHashtags,
        author: author,
      } as unknown as Tweet;

      jest.spyOn(userRepository, 'findOne').mockResolvedValueOnce(author);
      jest
        .spyOn(hashtagRepository, 'findBy')
        .mockResolvedValueOnce(existingHashtags);
      jest.spyOn(hashtagRepository, 'create').mockReturnValueOnce(newHashtag);
      jest.spyOn(hashtagRepository, 'save').mockResolvedValueOnce(newHashtag);

      jest.spyOn(tweetRepository, 'create').mockReturnValueOnce(createdTweet);
      jest.spyOn(tweetRepository, 'save').mockResolvedValueOnce(createdTweet);
      jest.spyOn(cacheService, 'setValue').mockResolvedValueOnce();

      const result = await service.create(createTweetDto);

      expect(result).toEqual(createdTweet);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: createTweetDto.authorId },
      });
      expect(hashtagRepository.findBy).toHaveBeenCalledWith({
        name: In(createTweetDto.hashtags),
      });
      expect(hashtagRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: newHashtag.name,
        }),
      );
      expect(tweetRepository.save).toHaveBeenCalledWith(expect.any(Tweet));
      expect(cacheService.setValue).toHaveBeenCalledWith(
        `cache:tweet:${createdTweet.id}`,
        expect.any(String),
      );
    });

    it('should throw an error if the author does not exist', async () => {
      const createTweetDto: CreateTweetDto = {
        content: 'Hello, world!',
        authorId: 999,
        parentTweetId: null,
        hashtags: [],
        location: '',
        category: TweetCategory.Tech,
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(service.create(createTweetDto)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw an error if the parent tweet does not exist', async () => {
      const createTweetDto: CreateTweetDto = {
        content: 'Hello, world!',
        authorId: 1,
        parentTweetId: '999',
        hashtags: [],
        location: '',
        category: TweetCategory.Tech,
      };

      const author = { id: '1', name: 'Test User' } as unknown as User;

      jest.spyOn(userRepository, 'findOne').mockResolvedValueOnce(author);
      jest.spyOn(tweetRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(service.create(createTweetDto)).rejects.toThrow(
        'Parent tweet not found',
      );
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
