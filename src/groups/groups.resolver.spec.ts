import { Test, TestingModule } from '@nestjs/testing';

import { Group, User } from '../graphql.schema';
import { GroupsResolver } from './groups.resolver';
import { GroupsService } from './groups.service';
import { UsersService } from '../users/users.service';
import { CreateGroupDto } from './dto/create-group.dto';

describe('GroupsResolver', () => {
  let resolver: GroupsResolver;

  const user1: User = {
    id: 1,
    userName: 'Username#1',
    firstName: 'firstName#1',
    lastName: 'lastName#1',
  };
  const user2: User = {
    id: 2,
    userName: 'Username#2',
    firstName: 'firstName#2',
    lastName: 'lastName#2',
  };
  const user3: User = {
    id: 3,
    userName: 'Username#3',
    firstName: 'firstName#3',
    lastName: 'lastName#3',
  };

  const group: Group = {
    id: 1,
    name: 'Group name #1',
    users: [user1, user2],
    creator: user3,
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsResolver,
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn().mockReturnValue([user1, user2, user3]),
          },
        },
        {
          provide: GroupsService,
          useValue: {
            create: jest.fn().mockImplementation((dto: CreateGroupDto) => ({
              id: 1,
              name: dto.name,
              users: dto.userIds.map((id) => ({ id })),
              creator: { id: dto.creatorId },
            })),
            findAll: jest.fn().mockReturnValue([group]),
            findOne: jest.fn().mockReturnValue(group),
          },
        },
      ],
    }).compile();

    resolver = moduleRef.get<GroupsResolver>(GroupsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should create a new group', async () => {
    const newGroup = await resolver.create({
      name: group.name,
      userIds: group.users.map((user) => user.id),
      creatorId: group.creator.id,
      parentGroupId: undefined,
    });

    expect(newGroup.name).toEqual(group.name);
    expect(newGroup.users.length).toEqual(2);
    expect(newGroup.creator.id).toEqual(user3.id);
  });

  it('should return all groups', async () => {
    const groups = await resolver.getGroups();
    expect(groups.length).toEqual(1);
    expect(groups[0].name).toEqual(group.name);
  });

  it('should return a group by id', async () => {
    const foundGroup = await resolver.findOneById(1);
    expect(foundGroup).toEqual(group);
  });
});
