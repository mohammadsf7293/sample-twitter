import { Test, TestingModule } from '@nestjs/testing';
import { TweetsResolver } from './tweets.resolver';
import { TweetsService } from './tweets.service';
import { TweetCategory } from './tweet.entity';
import { CreateTweetDto } from './dto/create-tweet.dto';
import { UpdateTweetDto } from './dto/update-tweet.dto';

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
    it('should create a new tweet', async () => {
      const createTweetDto: CreateTweetDto = {
        content: 'Hello, world!',
        authorId: 1,
        hashtags: ['nestjs'],
        location: 'Earth',
        category: TweetCategory.Tech,
        parentTweetId: null,
      };

      const result = await resolver.createTweet(createTweetDto);
      expect(result).toEqual(mockTweet);
      expect(service.create).toHaveBeenCalledWith(createTweetDto);
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
});
