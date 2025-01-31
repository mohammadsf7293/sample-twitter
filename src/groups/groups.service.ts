import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './group.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { In } from 'typeorm';
import { UsersService } from '../users/users.service';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,

    private readonly usersService: UsersService,
  ) {}

  // Example method to fetch all groups
  findAll(): Promise<Group[]> {
    return this.groupRepository.find();
  }

  findOne(id: number): Promise<Group> {
    return this.groupRepository.findOneBy({ id: id });
  }

  async remove(id: number): Promise<void> {
    await this.groupRepository.delete(id);
  }

  // Method to create a new group
  async create(createGroupDto: CreateGroupDto): Promise<Group> {
    const users = await this.usersService.findUsersByIds(
      createGroupDto.userIds,
    );
    if (users.length == 0) {
      throw new Error(`all users given in the userIds list are not found`);
    }

    const parentGroup = await this.groupRepository.findOneBy({
      id: createGroupDto.parentGroupId,
    });

    const creator = await this.usersService.findOneWithRelations(
      createGroupDto.creatorId,
      [],
    );
    if (!creator) {
      throw new Error(`Creator with ID ${createGroupDto.creatorId} not found`);
    }

    // Create the new group
    const group = new Group();
    group.name = createGroupDto.name;
    group.users = users;
    group.parentGroup = parentGroup;
    group.creator = creator;

    return this.groupRepository.save(group);
  }

  async findGroupsByIds(groupIds: number[]): Promise<Group[]> {
    return await this.groupRepository.find({
      where: { id: In(groupIds) },
    });
  }

  async findUserGroupsByUserIds(
    userIds: number[],
    authorId: number,
  ): Promise<Group[]> {
    const groups = await this.groupRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.users', 'user')
      .where('group.creatorId = :authorId', { authorId })
      .andWhere('user.id IN (:...userIds)', { userIds })
      .getMany();

    return groups;
  }
}
