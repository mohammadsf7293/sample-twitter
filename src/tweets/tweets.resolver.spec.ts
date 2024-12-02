import { Test, TestingModule } from '@nestjs/testing';
import { TweetsResolver } from './tweets.resolver';
import { TweetsService } from './tweets.service';
import { Tweet, TweetCategory } from './tweet.entity';
import { PaginatedTweets, Tweet as TweetDTO } from 'src/graphql.schema';
import { UpdateTweetDto } from './dto/update-tweet.dto';
import { UpdateTweetPermissionsDto } from './dto/update-tweet-permissions.dto';
import { Hashtag } from './hashtag.entity';

const mockTweet = {
  id: '1',
  content: 'Hello, world!',
  author: { id: 1, name: 'Author' },
  hashtags: [{ id: 1, name: 'nestjs' }],
  location: 'Earth',
  category: TweetCategory.Tech,
  parentTweet: null,
};

const mockTweetsService = {
  findAll: jest.fn().mockResolvedValue([mockTweet]),
  findOne: jest.fn().mockResolvedValue(mockTweet),
  findByAuthor: jest.fn().mockResolvedValue([mockTweet]),
  create: jest.fn().mockResolvedValue(mockTweet),
  update: jest.fn().mockResolvedValue({ ...mockTweet, content: 'Updated!' }),
  remove: jest.fn().mockResolvedValue(undefined),
  updateTweetPermissions: jest.fn(),
  canEdit: jest.fn(),
  paginateTweets: jest.fn(),
};

describe('TweetsResolver', () => {
  let resolver: TweetsResolver;
  let service: TweetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TweetsResolver,
        {
          provide: TweetsService,
          useValue: mockTweetsService,
        },
      ],
    }).compile();

    resolver = module.get<TweetsResolver>(TweetsResolver);
    service = module.get<TweetsService>(TweetsService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all tweets', async () => {
      const result = await resolver.findAll();
      expect(result).toEqual([mockTweet]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single tweet', async () => {
      const result = await resolver.findOne('1');
      expect(result).toEqual(mockTweet);
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('findByAuthor', () => {
    it('should return tweets by the author', async () => {
      const result = await resolver.findByAuthor(1);
      expect(result).toEqual([mockTweet]);
      expect(service.findByAuthor).toHaveBeenCalledWith(1);
    });
  });

  describe('createTweet', () => {
    it('should create a tweet and return the GraphQL tweet object', async () => {
      const createTweetInput = {
        content: 'This is a test tweet',
        authorId: 1,
        hashtags: ['#test', '#tweet'],
        parentTweetId: null,
        category: TweetCategory.News,
        location: 'Earth',
      };

      const createdTweetEntity = {
        id: 1,
        content: createTweetInput.content,
        author: { id: createTweetInput.authorId },
        hashtags: [],
        parentTweet: null,
        category: createTweetInput.category,
        location: createTweetInput.location,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Tweet;

      jest.spyOn(service, 'create').mockResolvedValue(createdTweetEntity);

      const result = await resolver.createTweet(createTweetInput);

      expect(result).toEqual({
        id: createdTweetEntity.id,
        content: createdTweetEntity.content,
        authorId: createdTweetEntity.author.id.toString(),
        hashtags: [],
        parentTweetId: null,
        category: createdTweetEntity.category,
        location: createdTweetEntity.location,
        createTime: Math.round(createdTweetEntity.createdAt.getTime() / 1000),
        updateTime: Math.round(createdTweetEntity.updatedAt.getTime() / 1000),
      });

      expect(service.create).toHaveBeenCalledWith(createTweetInput);
    });
  });

  describe('updateTweet', () => {
    it('should update a tweet', async () => {
      const updateTweetDto: UpdateTweetDto = { content: 'Updated!' };

      const result = await resolver.updateTweet('1', updateTweetDto);
      expect(result).toEqual({ ...mockTweet, content: 'Updated!' });
      expect(service.update).toHaveBeenCalledWith('1', updateTweetDto);
    });
  });

  describe('removeTweet', () => {
    it('should delete a tweet', async () => {
      const result = await resolver.removeTweet('1');
      expect(result).toEqual(true);
      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });

  describe('updateTweetPermissions', () => {
    it('should call service to update tweet permissions', async () => {
      const updatePermissionsDto: UpdateTweetPermissionsDto = {
        inheritViewPermissions: true,
        inheritEditPermissions: false,
        viewPermissionsUserIds: [1, 2],
        editPermissionsUserIds: [1],
        viewPermissionsGroupIds: [],
        editPermissionsGroupIds: [],
      };

      const result = await resolver.updateTweetPermissions(
        '1',
        updatePermissionsDto,
        1,
      );

      expect(result).toBe(true);
      expect(service.updateTweetPermissions).toHaveBeenCalledWith(
        '1',
        updatePermissionsDto,
        1,
      );
    });

    it('should throw an error if service call fails', async () => {
      const updatePermissionsDto: UpdateTweetPermissionsDto = {
        inheritViewPermissions: true,
        inheritEditPermissions: false,
        viewPermissionsUserIds: [1, 2],
        editPermissionsUserIds: [1],
        viewPermissionsGroupIds: [],
        editPermissionsGroupIds: [],
      };

      jest
        .spyOn(service, 'updateTweetPermissions')
        .mockRejectedValueOnce(new Error('Service error'));

      await expect(
        resolver.updateTweetPermissions('1', updatePermissionsDto, 1),
      ).rejects.toThrow('Service error');

      expect(service.updateTweetPermissions).toHaveBeenCalledWith(
        '1',
        updatePermissionsDto,
        1,
      );
    });
  });

  describe('canEditTweet', () => {
    it('should return true if the user can edit the tweet', async () => {
      jest.spyOn(service, 'canEdit').mockResolvedValue(true);
      const result = await resolver.canEditTweet(1, '12345');
      expect(result).toBe(true);
      expect(service.canEdit).toHaveBeenCalledWith(1, '12345');
    });

    it('should return false if the user cannot edit the tweet', async () => {
      jest.spyOn(service, 'canEdit').mockResolvedValue(false);
      const result = await resolver.canEditTweet(1, '12345');
      expect(result).toBe(false);
      expect(service.canEdit).toHaveBeenCalledWith(1, '12345');
    });
  });

  describe('paginateTweets', () => {
    it('should return paginated tweets', async () => {
      const mockTweets = [
        {
          id: '1',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-02T00:00:00Z'),
          content: 'Tweet 1',
          hashtags: [{ id: '1', name: '#hashtag1' } as Hashtag],
          author: { id: '123' },
          parentTweet: null,
          category: 'Category1',
          location: 'Location1',
        } as unknown as Tweet,
        {
          id: '2',
          createdAt: new Date('2024-01-03T00:00:00Z'),
          updatedAt: new Date('2024-01-04T00:00:00Z'),
          content: 'Tweet 2',
          hashtags: [{ id: '2', name: '#hashtag2' } as Hashtag],
          author: { id: '124' },
          parentTweet: null,
          category: 'Category2',
          location: 'Location2',
        } as unknown as Tweet,
      ];

      const hasNextPage = false;
      jest
        .spyOn(service, 'paginateTweets')
        .mockResolvedValue({ nodes: mockTweets, hasNextPage });
      // service.paginateTweets.mockResolvedValue({ nodes: mockTweets, hasNextPage });

      const result: PaginatedTweets = await resolver.paginateTweets(123, 2, 1);

      expect(result.nodes.length).toBe(2); // Ensure the correct number of tweets
      expect(result.hasNextPage).toBe(false); // Ensure the pagination flag is set correctly

      // Check that each Tweet is transformed into the correct DTO
      expect(result.nodes[0].id).toBe('1');
      expect(result.nodes[1].id).toBe('2');
      expect(result.nodes[0].createTime).toBe(
        Math.round(mockTweets[0].createdAt.getTime() / 1000),
      );
      expect(result.nodes[1].createTime).toBe(
        Math.round(mockTweets[1].createdAt.getTime() / 1000),
      );
    });

    it('should return empty results if no tweets are found', async () => {
      jest
        .spyOn(service, 'paginateTweets')
        .mockResolvedValue({ nodes: [], hasNextPage: false });

      const result: PaginatedTweets = await resolver.paginateTweets(123, 5, 1);

      expect(result.nodes.length).toBe(0); // No tweets should be returned
      expect(result.hasNextPage).toBe(false); // No next page flag should be set
    });

    it('should return correct results for multiple pages', async () => {
      const mockTweetsPage1 = [
        {
          id: '1',
          createdAt: new Date(),
          updatedAt: new Date(),
          content: 'Tweet 1',
          hashtags: [{ id: '1', name: '#hashtag1' } as Hashtag],
          author: { id: '123' },
          parentTweet: null,
          category: TweetCategory.Finance,
          location: 'Location1',
        } as unknown as Tweet,
        {
          id: '2',
          createdAt: new Date(),
          updatedAt: new Date(),
          content: 'Tweet 2',
          hashtags: [{ id: '2', name: '#hashtag2' } as Hashtag],
          author: { id: '124' },
          parentTweet: null,
          category: TweetCategory.News,
          location: 'Location2',
        } as unknown as Tweet,
      ];
      const mockTweetsPage2 = [
        {
          id: '3',
          createdAt: new Date(),
          updatedAt: new Date(),
          content: 'Tweet 3',
          hashtags: [{ id: '3', name: '#hashtag3' } as Hashtag],
          author: { id: '125' },
          parentTweet: null,
          category: TweetCategory.Sport,
          location: 'Location3',
        } as unknown as Tweet,
        {
          id: '4',
          createdAt: new Date(),
          updatedAt: new Date(),
          content: 'Tweet 4',
          hashtags: [{ id: '4', name: '#hashtag4' } as Hashtag],
          author: { id: '126' },
          parentTweet: null,
          category: TweetCategory.Tech,
          location: 'Location4',
        } as unknown as Tweet,
      ];

      // Mock responses for different pages
      jest.spyOn(service, 'paginateTweets').mockResolvedValueOnce({
        nodes: mockTweetsPage1,
        hasNextPage: true,
      });

      jest.spyOn(service, 'paginateTweets').mockResolvedValueOnce({
        nodes: mockTweetsPage2,
        hasNextPage: false,
      }); // Second page

      const resultPage1: PaginatedTweets = await resolver.paginateTweets(
        123,
        2,
        1,
      );

      const resultPage2: PaginatedTweets = await resolver.paginateTweets(
        123,
        2,
        2,
      );

      // First page
      expect(resultPage1.nodes.length).toBe(2);
      expect(resultPage1.hasNextPage).toBe(true);

      // Second page
      expect(resultPage2.nodes.length).toBe(2);
      expect(resultPage2.hasNextPage).toBe(false);
    });

    it('should map entity fields correctly in the response', async () => {
      const mockTweet = {
        id: '123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        content: 'This is a tweet',
        hashtags: [{ id: '3', name: '#hashtag3' } as Hashtag],
        author: { id: '456', name: 'Author' } as any,
        parentTweet: null,
        category: TweetCategory.Finance,
        location: 'Location1',
      } as unknown as Tweet;

      const hasNextPage = false;
      jest
        .spyOn(service, 'paginateTweets')
        .mockResolvedValue({ nodes: [mockTweet], hasNextPage });

      const result: PaginatedTweets = await resolver.paginateTweets(123, 1, 1);

      // Ensure the toGraphQLTweet function is invoked and result is mapped correctly
      expect(result.nodes[0].id).toBe('123');
      expect(result.nodes[0].createTime).toBe(
        Math.round(mockTweet.createdAt.getTime() / 1000),
      );
      expect(result.nodes[0].authorId).toBe('456');
      expect(result.nodes[0].content).toBe('This is a tweet');
    });
  });

  describe('toGraphQLTweet', () => {
    it('should correctly map Tweet entity to TweetDTO', () => {
      const tweetEntity: Tweet = {
        id: '123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        content: 'This is a tweet',
        hashtags: [
          { id: '1', name: '#hashtag1' } as Hashtag,
          { id: '2', name: '#hashtag2' } as Hashtag,
        ],
        author: { id: '456', name: 'Author' } as any, // Mocking the user entity
        parentTweet: null,
        category: TweetCategory.Tech,
        location: 'Location1',
      } as Tweet;

      const result: TweetDTO = (resolver as any).toGraphQLTweet(tweetEntity);

      expect(result.id).toBe('123');
      expect(result.createTime).toBe(
        Math.round(tweetEntity.createdAt.getTime() / 1000),
      );
      expect(result.updateTime).toBe(
        Math.round(tweetEntity.updatedAt.getTime() / 1000),
      );
      expect(result.content).toBe('This is a tweet');
      expect(result.hashtags).toEqual(['#hashtag1', '#hashtag2']); // Check hashtags
      expect(result.parentTweetId).toBeNull(); // Parent tweet is null
      expect(result.category).toBe(TweetCategory.Tech);
      expect(result.location).toBe('Location1');
      expect(result.authorId).toBe('456'); // Author ID should be passed as string
    });

    it('should correctly map Tweet entity with a parent tweet', () => {
      const tweetEntity: Tweet = {
        id: '123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        content: 'This is a tweet',
        hashtags: [
          { id: '1', name: '#hashtag1' } as Hashtag,
          { id: '2', name: '#hashtag2' } as Hashtag,
        ],
        author: { id: '456', name: 'Author' } as any,
        parentTweet: {
          id: '789',
          createdAt: new Date('2023-12-01T00:00:00Z'),
          updatedAt: new Date('2023-12-02T00:00:00Z'),
          content: 'This is a parent tweet',
          hashtags: [],
          author: { id: '111', name: 'Parent Author' } as any, // Mocking the user entity
          parentTweet: null,
          category: 'ParentCategory',
          location: 'ParentLocation',
        } as any, // Mock parent tweet entity
        category: TweetCategory.Tech,
        location: 'Location1',
      } as Tweet;

      const result: TweetDTO = (resolver as any).toGraphQLTweet(tweetEntity);

      expect(result.parentTweetId).toBe('789'); // Parent tweet ID should be mapped correctly
    });

    it('should handle empty hashtags array correctly', () => {
      const tweetEntity: Tweet = {
        id: '123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        content: 'This is a tweet',
        hashtags: [],
        author: { id: '456', name: 'Author' } as any, // Mocking the user entity
        parentTweet: null,
        category: TweetCategory.Sport,
        location: 'Location1',
      } as Tweet;

      const result: TweetDTO = (resolver as any).toGraphQLTweet(tweetEntity);

      expect(result.hashtags).toEqual([]); // Empty hashtags array
    });
  });
});
