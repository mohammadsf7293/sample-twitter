import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Group } from './group.entity';
import { GroupsService } from './groups.service';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

// Mock data for users and groups
const mockUsers = [
  {
    id: 1,
    userName: 'User1',
    firstName: 'User #1 firstName',
    lastName: 'User #1 lastName',
  },
  {
    id: 2,
    userName: 'User2',
    firstName: 'User #2 firstName',
    lastName: 'User #2 lastName',
  },
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

describe('GroupsService', () => {
  let service: GroupsService;
  let groupRepository: Repository<Group>;
  // let userRepository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        {
          provide: getRepositoryToken(Group),
          useValue: {
            find: jest.fn().mockResolvedValue(groupArray),
            findOneBy: jest.fn().mockResolvedValue(oneGroup),
            findBy: jest.fn().mockResolvedValue(groupArray),
            save: jest.fn().mockResolvedValue(oneGroup),
            remove: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            // Mock the `findBy` method to simulate `In()` functionality
            findBy: jest.fn().mockImplementation(({ id }) => {
              if (id && Array.isArray(id)) {
                return Promise.resolve(
                  mockUsers.filter((user) => id.includes(user)),
                );
              }
              return Promise.resolve([]);
            }),
            findOneBy: jest.fn().mockResolvedValue(mockUsers[0]),
          },
        },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
    groupRepository = module.get<Repository<Group>>(getRepositoryToken(Group));
    // userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    it('should successfully insert a group with non-empty users null parentGroup', async () => {
      const createGroupDto = {
        name: 'group1',
        userIds: [1, 2],
        parentGroupId: null,
        creatorId: 1,
      };

      expect(await service.create(createGroupDto)).toEqual(oneGroup);
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
      const repoSpy = jest.spyOn(groupRepository, 'findOneBy');
      expect(service.findOne(1)).resolves.toEqual(oneGroup);
      expect(repoSpy).toBeCalledWith({ id: 1 });

      // Verify specific properties
      service.findOne(1).then((group) => {
        expect(group.users).toEqual(mockUsers);
        expect(group.parentGroup).toBeUndefined();
      });
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
