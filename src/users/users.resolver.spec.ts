import { Test, TestingModule } from '@nestjs/testing';

import { User } from '../graphql.schema';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

describe('UsersResolver', () => {
  let resolver: UsersResolver;
  const user: User = {
    userName: 'Username#1',
    firstName: 'firstName#1',
    lastName: 'lastName#1',
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsersResolver,
        {
          provide: UsersService,
          useValue: {
            create: jest
              .fn()
              .mockImplementation((user: User) => ({ id: 1, ...user })),
            findAll: jest.fn().mockReturnValue([user]),
            findOne: jest
              .fn()
              .mockImplementation((id: number) => ({ ...user, id })),
          },
        },
      ],
    }).compile();

    resolver = moduleRef.get<UsersResolver>(UsersResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should create a new user', async () => {
    const newUser = await resolver.create({
      userName: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    expect(newUser.userName).toEqual(user.userName);
    expect(newUser.firstName).toEqual(user.firstName);
    expect(newUser.lastName).toEqual(user.lastName);
    expect(newUser).toEqual({ id: 1, ...user });
  });

  it('should return all users', async () => {
    const users = await resolver.getUsers();
    expect(users.length).toEqual(1);
    expect(users[0].userName).toEqual(user.userName);
    expect(users[0].firstName).toEqual(user.firstName);
    expect(users[0].lastName).toEqual(user.lastName);
  });

  it('should return a user by id', async () => {
    const user = await resolver.findOneById(1);
    expect(user).toEqual({ ...user, id: 1 });
  });
});
