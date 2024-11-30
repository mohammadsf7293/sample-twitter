import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { In, Repository } from 'typeorm';
import { Group } from 'src/groups/group.entity';

const mockUsers = [
  {
    id: 1,
    userName: 'userName1',
    firstName: 'firstName #1',
    lastName: 'lastName #1',
  },
  {
    id: 2,
    userName: 'userName2',
    firstName: 'firstName #2',
    lastName: 'lastName #2',
  },
  {
    id: 3,
    userName: 'userName3',
    firstName: 'firstName #3',
    lastName: 'lastName #3',
  },
];

const oneUser = {
  id: 1,
  userName: 'userName1',
  firstName: 'firstName #1',
  lastName: 'lastName #1',
};

describe('UserService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue(mockUsers),
            findOneBy: jest.fn().mockResolvedValue(oneUser),
            save: jest.fn().mockResolvedValue(oneUser),
            remove: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    it('should successfully insert a user', () => {
      const oneUser = {
        id: 1,
        userName: 'userName1',
        firstName: 'firstName #1',
        lastName: 'lastName #1',
      };

      expect(
        service.create({
          userName: 'userName1',
          firstName: 'firstName #1',
          lastName: 'lastName #1',
        }),
      ).resolves.toEqual(oneUser);
    });
  });

  describe('findAll()', () => {
    it('should return an array of users', async () => {
      const users = await service.findAll();
      expect(users).toEqual(mockUsers);
    });
  });

  describe('findOne()', () => {
    it('should get a single user', () => {
      const repoSpy = jest.spyOn(repository, 'findOneBy');
      expect(service.findOne(1)).resolves.toEqual(oneUser);
      expect(repoSpy).toBeCalledWith({ id: 1 });
    });
  });

  describe('remove()', () => {
    it('should call remove with the passed value', async () => {
      const removeSpy = jest.spyOn(repository, 'delete');
      const retVal = await service.remove(2);
      expect(removeSpy).toBeCalledWith(2);
      expect(retVal).toBeUndefined();
    });
  });

  describe('findUsersByIds', () => {
    it('should return users matching the given IDs', async () => {
      const userIds = [1, 2];
      jest
        .spyOn(repository, 'find')
        .mockResolvedValue([mockUsers[0] as User, mockUsers[1] as User]);
      const result = await service.findUsersByIds(userIds);

      expect(result).toEqual([mockUsers[0], mockUsers[1]]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { id: In(userIds) },
      });
    });

    it('should return an empty array if no users found', async () => {
      const userIds = [999, 1000];
      // Modify the mock to return an empty array when these IDs are requested
      jest.spyOn(repository, 'find').mockResolvedValue([]);
      const result = await service.findUsersByIds(userIds);

      expect(result).toEqual([]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { id: In(userIds) },
      });
    });

    it('should return all users if all IDs are present', async () => {
      const userIds = [1, 2, 3];
      const result = await service.findUsersByIds(userIds);

      expect(result).toEqual(mockUsers);
      expect(repository.find).toHaveBeenCalledWith({
        where: { id: In(userIds) },
      });
    });
  });

  describe('isUserInGroupIds', () => {
    it('should return true if the user is in at least one of the groups', async () => {
      const mockGroups: Group[] = [
        { id: 1, name: 'Group 1' } as Group,
        { id: 2, name: 'Group 2' } as Group,
      ];
      const mockUser: User = {
        id: 1,
        name: 'John Doe',
        groups: mockGroups,
      } as unknown as User;
      const groupIds = [2, 3];

      const result = await service.isUserInGroupIds(mockUser, groupIds);

      expect(result).toBe(true);
    });

    it('should return false if the user is not in any of the groups', async () => {
      const mockGroups: Group[] = [
        { id: 1, name: 'Group 1' } as Group,
        { id: 2, name: 'Group 2' } as Group,
      ];
      const mockUser: User = {
        id: 1,
        name: 'John Doe',
        groups: mockGroups,
      } as unknown as User;
      const groupIds = [3, 4];

      const result = await service.isUserInGroupIds(mockUser, groupIds);

      expect(result).toBe(false);
    });

    it('should return false if the user has no groups', async () => {
      const mockUser: User = {
        id: 1,
        name: 'John Doe',
        groups: [],
      } as unknown as User;
      const groupIds = [1, 2];

      const result = await service.isUserInGroupIds(mockUser, groupIds);

      expect(result).toBe(false);
    });

    it('should return false if the groupIds array is empty', async () => {
      const mockGroups: Group[] = [
        { id: 1, name: 'Group 1' } as Group,
        { id: 2, name: 'Group 2' } as Group,
      ];
      const mockUser: User = {
        id: 1,
        name: 'John Doe',
        groups: mockGroups,
      } as unknown as User;
      const groupIds: number[] = [];

      const result = await service.isUserInGroupIds(mockUser, groupIds);

      expect(result).toBe(false);
    });
  });
});
