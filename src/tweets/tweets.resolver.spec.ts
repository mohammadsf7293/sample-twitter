import { Test, TestingModule } from '@nestjs/testing';
import { TweetsResolver } from './tweets.resolver';
import { TweetsService } from './tweets.service';
import { TweetCategory } from './tweet.entity';
import { CreateTweetDto } from './dto/create-tweet.dto';
import { UpdateTweetDto } from './dto/update-tweet.dto';
import { UpdateTweetPermissionsDto } from './dto/update-tweet-permissions.dto';

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
});
