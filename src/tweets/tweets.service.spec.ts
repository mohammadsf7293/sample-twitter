import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TweetsService } from './tweets.service';
import { Tweet, TweetCategory } from './tweet.entity';
import { User } from '../users/user.entity';
import { Hashtag } from './hashtag.entity';
import { CreateTweetDto } from './dto/create-tweet.dto';
import { UpdateTweetDto } from './dto/update-tweet.dto';

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
  create: jest.fn(),
  save: jest.fn(),
};

describe('TweetsService', () => {
  let service: TweetsService;
  let tweetRepository: Repository<Tweet>;
  let userRepository: Repository<User>;
  let hashtagRepository: Repository<Hashtag>;

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
      ],
    }).compile();

    service = module.get<TweetsService>(TweetsService);
    tweetRepository = module.get<Repository<Tweet>>(getRepositoryToken(Tweet));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    hashtagRepository = module.get<Repository<Hashtag>>(
      getRepositoryToken(Hashtag),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new tweet', async () => {
      const createTweetDto: CreateTweetDto = {
        content: 'Hello, world!',
        authorId: 1,
        parentTweetId: null,
        hashtags: ['nestjs', 'typescript'],
        location: 'Earth',
        category: TweetCategory.Tech,
      };

      const author = { id: '1', name: 'Test User' } as unknown as User;
      const existingHashtags = [{ id: '1', name: 'nestjs' }] as Hashtag[];
      const newHashtag = { id: '2', name: 'typescript' } as Hashtag;
      const createdTweet = { id: '1', ...createTweetDto } as unknown as Tweet;

      jest.spyOn(userRepository, 'findOne').mockResolvedValueOnce(author);
      jest
        .spyOn(hashtagRepository, 'findBy')
        .mockResolvedValueOnce(existingHashtags);
      jest.spyOn(hashtagRepository, 'create').mockReturnValueOnce(newHashtag);
      jest.spyOn(hashtagRepository, 'save').mockResolvedValueOnce(newHashtag);
      jest.spyOn(tweetRepository, 'create').mockReturnValueOnce(createdTweet);
      jest.spyOn(tweetRepository, 'save').mockResolvedValueOnce(createdTweet);

      const result = await service.create(createTweetDto);

      expect(result).toEqual(createdTweet);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: createTweetDto.authorId },
      });
      expect(hashtagRepository.findBy).toHaveBeenCalledWith({
        name: In(createTweetDto.hashtags),
      });
      expect(hashtagRepository.save).toHaveBeenCalledWith(newHashtag);
      expect(tweetRepository.save).toHaveBeenCalledWith(expect.any(Tweet));
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

  describe('findAll', () => {
    it('should return all tweets', async () => {
      const tweets = [{ id: '1', content: 'Hello' }] as Tweet[];
      jest.spyOn(tweetRepository, 'find').mockResolvedValueOnce(tweets);

      const result = await service.findAll();

      expect(result).toEqual(tweets);
      expect(tweetRepository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a tweet by ID', async () => {
      const tweet = { id: '1', content: 'Hello' } as Tweet;
      jest.spyOn(tweetRepository, 'findOne').mockResolvedValueOnce(tweet);

      const result = await service.findOne('1');

      expect(result).toEqual(tweet);
      expect(tweetRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['author', 'hashtags', 'parentTweet', 'childTweets'],
      });
    });

    it('should return null if the tweet is not found', async () => {
      jest.spyOn(tweetRepository, 'findOne').mockResolvedValueOnce(null);

      const result = await service.findOne('999');

      expect(result).toBe(null);
    });
  });

  describe('update', () => {
    it('should update a tweet', async () => {
      const updateTweetDto: UpdateTweetDto = { content: 'Updated content' };
      const tweet = { id: '1', content: 'Old content' } as Tweet;

      jest.spyOn(tweetRepository, 'findOne').mockResolvedValueOnce(tweet);
      jest
        .spyOn(tweetRepository, 'save')
        .mockResolvedValueOnce({ ...tweet, ...updateTweetDto });

      const result = await service.update('1', updateTweetDto);

      expect(result).toEqual({ ...tweet, ...updateTweetDto });
      expect(tweetRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(updateTweetDto),
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
