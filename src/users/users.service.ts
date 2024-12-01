import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  create(createUserDto: CreateUserDto): Promise<User> {
    const user = new User();
    user.userName = createUserDto.userName;
    user.firstName = createUserDto.firstName;
    user.lastName = createUserDto.lastName;

    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  findOne(id: number): Promise<User> {
    return this.usersRepository.findOneBy({ id: id });
  }

  findOneWithRelations(id: number, relations: string[]): Promise<User> {
    return this.usersRepository.findOne({
      where: { id: id },
      relations: relations,
    });
  }

  async remove(id: number): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async findUsersByIds(userIds: number[]): Promise<User[]> {
    return await this.usersRepository.find({
      where: { id: In(userIds) },
    });
  }

  public async isUserInGroupIds(
    user: User,
    groupIds: number[],
  ): Promise<boolean> {
    const userGroups = user.groups;
    if (user.groups.length == 0) {
      return false;
    }
    return groupIds.some((groupId) =>
      userGroups.some((group) => group.id === groupId),
    );
  }
}
