import { Test, TestingModule } from '@nestjs/testing';
import { HashtagsService } from './hashtags.service';
import { Hashtag } from './hashtag.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateHashtagDto } from './dto/create-hashtag-dto';

describe('HashtagsService', () => {
  let service: HashtagsService;

  const mockHashtagRepository = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    delete: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HashtagsService,
        {
          provide: getRepositoryToken(Hashtag),
          useValue: mockHashtagRepository,
        },
      ],
    }).compile();

    service = module.get<HashtagsService>(HashtagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of hashtags', async () => {
      const result = [
        { id: 'd0a4a9b7-d8da-4a6a-8763-26b0e9e4e2d1', name: '#Tech' },
        { id: '9fbd9a2c-c22a-4f59-8d53-b9ff5d34f3ad', name: '#News' },
      ];
      mockHashtagRepository.find.mockResolvedValue(result);

      const hashtags = await service.findAll();
      expect(hashtags).toEqual(result);
      expect(mockHashtagRepository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single hashtag by id', async () => {
      const result = {
        id: 'd0a4a9b7-d8da-4a6a-8763-26b0e9e4e2d1',
        name: '#Tech',
      };
      mockHashtagRepository.findOneBy.mockResolvedValue(result);

      const hashtag = await service.findOne(
        'd0a4a9b7-d8da-4a6a-8763-26b0e9e4e2d1',
      );
      expect(hashtag).toEqual(result);
      expect(mockHashtagRepository.findOneBy).toHaveBeenCalledWith({
        id: 'd0a4a9b7-d8da-4a6a-8763-26b0e9e4e2d1',
      });
    });

    it('should throw error if hashtag not found', async () => {
      mockHashtagRepository.findOneBy.mockResolvedValue(null);

      try {
        await service.findOne('non-existing-id');
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe('create', () => {
    it('should create a new hashtag', async () => {
      const createHashtagDto: CreateHashtagDto = { name: '#Tech' };
      const result = {
        id: 'd0a4a9b7-d8da-4a6a-8763-26b0e9e4e2d1',
        name: '#Tech',
      };
      mockHashtagRepository.save.mockResolvedValue(result);

      const hashtag = await service.create(createHashtagDto);
      expect(hashtag).toEqual(result);
      expect(mockHashtagRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(createHashtagDto),
      );
    });
  });

  describe('remove', () => {
    it('should delete a hashtag by id', async () => {
      const result = undefined; // No return value on successful delete
      mockHashtagRepository.delete.mockResolvedValue(result);

      await service.remove('d0a4a9b7-d8da-4a6a-8763-26b0e9e4e2d1');
      expect(mockHashtagRepository.delete).toHaveBeenCalledWith(
        'd0a4a9b7-d8da-4a6a-8763-26b0e9e4e2d1',
      );
    });

    it('should throw error if deletion fails', async () => {
      mockHashtagRepository.delete.mockRejectedValue(
        new Error('Deletion failed'),
      );

      try {
        await service.remove('non-existing-id');
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });
});
