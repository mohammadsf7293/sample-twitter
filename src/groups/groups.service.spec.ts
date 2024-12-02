import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Group } from './group.entity';
import { GroupsService } from './groups.service';
import { In, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { User } from '../users/user.entity';

// Mock data for users and groups
const mockUsers = [
  {
    id: 1,
    userName: 'User1',
    firstName: 'User #1 firstName',
    lastName: 'User #1 lastName',
  } as unknown as User,
  {
    id: 2,
    userName: 'User2',
    firstName: 'User #2 firstName',
    lastName: 'User #2 lastName',
  } as unknown as User,
];

const mockParentGroup = { id: 3, users: [], childGroups: [], parentGroups: [] };

// Mock data for groups
const groupArray = [
  {
    id: 1,
    users: mockUsers,
    parentGroup: mockParentGroup,
  },
  {
    id: 2,
    users: mockUsers,
  },
];

const oneGroup = {
  id: 1,
  name: 'group1',
  users: mockUsers,
  creatorId: 1,
  parentGroupId: null,
};

const mockGroupRepository = {
  find: jest.fn().mockResolvedValue(groupArray),
  findOneBy: jest.fn().mockResolvedValue(oneGroup),
  findBy: jest.fn().mockResolvedValue(groupArray),
  save: jest.fn().mockResolvedValue(oneGroup),
  remove: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockUsersService = {
  findUsersByIds: jest.fn(),
  findOneWithRelations: jest.fn(),
};

describe('GroupsService', () => {
  let service: GroupsService;
  let groupRepository: Repository<Group>;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        {
          provide: getRepositoryToken(Group),
          useValue: mockGroupRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
    groupRepository = module.get<Repository<Group>>(getRepositoryToken(Group));
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new group successfully', async () => {
      const createGroupDto: CreateGroupDto = {
        ...oneGroup,
        name: 'New Group',
        userIds: [1, 2],
        parentGroupId: null,
        creatorId: 1,
      };

      const users = [
        { id: 1, userName: 'User1' } as User,
        { id: 2, userName: 'User2' } as User,
      ];
      const parentGroup = null;
      const creator = { id: 1, userName: 'Creator' } as User;

      jest.spyOn(usersService, 'findUsersByIds').mockResolvedValue(users);

      jest.spyOn(groupRepository, 'findOneBy').mockResolvedValue(parentGroup);

      jest
        .spyOn(usersService, 'findOneWithRelations')
        .mockResolvedValue(creator);

      jest.spyOn(groupRepository, 'save').mockResolvedValue({
        id: 1, // Mocked ID after saving
        name: createGroupDto.name,
        users: await usersService.findUsersByIds(createGroupDto.userIds),
        parentGroup: null, // or the parent group if available
        creator: creator, // creator object
        childGroups: [], // assuming no child groups for now
        viewableTweets: [],
        editableTweets: [], // assuming no viewable tweets
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const result = await service.create(createGroupDto);

      expect(result.name).toBe('New Group');
      expect(result.users).toEqual(users);
      expect(result.creator).toEqual(creator);
      expect(groupRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Group',
          users,
          parentGroup: null,
          creator,
        }),
      );
    });

    it('should throw an error if creator is not found', async () => {
      const createGroupDto: CreateGroupDto = {
        name: 'New Group',
        userIds: [1, 2],
        parentGroupId: null,
        // Non-existing creator ID
        creatorId: 99,
      };

      jest.spyOn(usersService, 'findUsersByIds').mockResolvedValue(mockUsers);
      jest.spyOn(groupRepository, 'findOneBy').mockResolvedValue(null);
      jest.spyOn(usersService, 'findOneWithRelations').mockResolvedValue(null); // Simulate that creator is not found

      await expect(service.create(createGroupDto)).rejects.toThrowError(
        `Creator with ID 99 not found`,
      );
    });

    it('should throw an error if users are not found', async () => {
      const createGroupDto: CreateGroupDto = {
        name: 'New Group',
        userIds: [1, 2],
        parentGroupId: null,
        creatorId: 1,
      };

      const creator = { id: 1, userName: 'Creator' } as unknown as User;
      // Simulating no users found
      jest.spyOn(usersService, 'findUsersByIds').mockResolvedValue([]);
      jest.spyOn(groupRepository, 'findOneBy').mockResolvedValue(null);
      jest
        .spyOn(usersService, 'findOneWithRelations')
        .mockResolvedValue(creator);

      await expect(service.create(createGroupDto)).rejects.toThrowError(
        'all users given in the userIds list are not found',
      );
    });

    it('should handle the parent group being not found', async () => {
      const createGroupDto: CreateGroupDto = {
        name: 'New Group',
        userIds: [1, 2],
        parentGroupId: 999, // Non-existing parent group ID
        creatorId: 1,
      };

      const users = [
        { id: 1, userName: 'User1' } as unknown as User,
        { id: 2, userName: 'User2' } as unknown as User,
      ];
      const creator = { id: 1, userName: 'Creator' } as unknown as User;

      jest.spyOn(usersService, 'findUsersByIds').mockResolvedValue(users);
      jest.spyOn(groupRepository, 'findOneBy').mockResolvedValue(null);
      jest
        .spyOn(usersService, 'findOneWithRelations')
        .mockResolvedValue(creator);
      jest.spyOn(groupRepository, 'save').mockResolvedValue({
        id: 1, // Mocked ID after saving
        name: createGroupDto.name,
        users: await usersService.findUsersByIds(createGroupDto.userIds),
        parentGroup: null, // or the parent group if available
        creator: creator, // creator object
        childGroups: [], // assuming no child groups for now
        viewableTweets: [],
        editableTweets: [], // assuming no viewable tweets
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createGroupDto);

      expect(result.name).toBe('New Group');
      expect(result.users).toEqual(users);
      expect(result.creator).toEqual(creator);
      expect(groupRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Group',
          users,
          parentGroup: null,
          creator,
        }),
      );
    });
  });

  describe('findAll()', () => {
    it('should return an array of groups with populated users and one parentGroup or no parentGroup', async () => {
      const groups = await service.findAll();
      expect(groups).toEqual(groupArray);

      // Check specific properties of the returned data
      expect(groups[0].users).toEqual(mockUsers);
      expect(groups[0].parentGroup).toEqual(mockParentGroup);

      expect(groups[1].users).toEqual(mockUsers);
      expect(groups[1].parentGroup).toBeUndefined();
    });
  });

  describe('findOne()', () => {
    it('should get a single group with users and no parentGroups', () => {
      const repoSpy = jest
        .spyOn(groupRepository, 'findOneBy')
        .mockResolvedValue(oneGroup as unknown as Group);
      expect(service.findOne(1)).resolves.toEqual(oneGroup);
      expect(repoSpy).toBeCalledWith({ id: 1 });

      // Verify specific properties
      service.findOne(1).then((group) => {
        expect(group.users).toEqual(mockUsers);
        expect(group.parentGroup).toBeUndefined();
      });
    });
  });

  describe('findUserGroupsByUserIds', () => {
    it('should return groups matching the provided user IDs and authorId', async () => {
      const mockGroups = [
        {
          id: 1,
          name: 'Group A',
          creatorId: 42,
          users: [{ id: 1 }, { id: 2 }],
        },
        {
          id: 2,
          name: 'Group B',
          creatorId: 42,
          users: [{ id: 2 }, { id: 3 }],
        },
        {
          id: 3,
          name: 'Group C',
          creatorId: 43,
          users: [{ id: 2 }, { id: 3 }],
        },
      ];

      const createQueryBuilderMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockGroups),
      };

      mockGroupRepository.createQueryBuilder.mockReturnValue(
        createQueryBuilderMock,
      );

      const userIds = [1, 2];
      const authorId = 42;

      const result = await service.findUserGroupsByUserIds(userIds, authorId);

      expect(result).toEqual(mockGroups);
      expect(createQueryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith(
        'group.users',
        'user',
      );
      expect(createQueryBuilderMock.where).toHaveBeenCalledWith(
        'group.creatorId = :authorId',
        { authorId },
      );
      expect(createQueryBuilderMock.andWhere).toHaveBeenCalledWith(
        'user.id IN (:...userIds)',
        { userIds },
      );
      expect(createQueryBuilderMock.getMany).toHaveBeenCalled();
    });

    it('should return an empty array if no matching groups are found', async () => {
      const createQueryBuilderMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockGroupRepository.createQueryBuilder.mockReturnValue(
        createQueryBuilderMock,
      );

      const userIds = [10, 20];
      const authorId = 99;

      const result = await service.findUserGroupsByUserIds(userIds, authorId);

      expect(result).toEqual([]);
      expect(createQueryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith(
        'group.users',
        'user',
      );
      expect(createQueryBuilderMock.where).toHaveBeenCalledWith(
        'group.creatorId = :authorId',
        { authorId },
      );
      expect(createQueryBuilderMock.andWhere).toHaveBeenCalledWith(
        'user.id IN (:...userIds)',
        { userIds },
      );
      expect(createQueryBuilderMock.getMany).toHaveBeenCalled();
    });
  });

  describe('findGroupsByIds', () => {
    it('should return an array of groups when valid IDs are passed', async () => {
      // Arrange
      const groupIds = [1, 2, 3];
      const mockGroups = [
        { id: 1, name: 'Group 1' } as Group,
        { id: 2, name: 'Group 2' } as Group,
        { id: 3, name: 'Group 3' } as Group,
      ];
      mockGroupRepository.find.mockResolvedValue(mockGroups);

      // Act
      const result = await service.findGroupsByIds(groupIds);

      // Assert
      expect(result).toEqual(mockGroups);
      expect(mockGroupRepository.find).toHaveBeenCalledWith({
        where: { id: In(groupIds) },
      });
    });

    it('should return an empty array if no groups are found for the given IDs', async () => {
      // Arrange
      const groupIds = [10, 11, 12];
      mockGroupRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.findGroupsByIds(groupIds);

      // Assert
      expect(result).toEqual([]);
      expect(mockGroupRepository.find).toHaveBeenCalledWith({
        where: { id: In(groupIds) },
      });
    });

    it('should throw an error if the repository throws an error', async () => {
      // Arrange
      const groupIds = [1, 2, 3];
      mockGroupRepository.find.mockRejectedValue(
        new Error('Something went wrong'),
      );

      // Act & Assert
      await expect(service.findGroupsByIds(groupIds)).rejects.toThrow(
        'Something went wrong',
      );
    });
  });

  describe('remove()', () => {
    it('should call remove with the passed value', async () => {
      const removeSpy = jest.spyOn(groupRepository, 'delete');
      const retVal = await service.remove(2);
      expect(removeSpy).toBeCalledWith(2);
      expect(retVal).toBeUndefined();
    });
  });
});
