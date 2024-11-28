import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './group.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { User } from '../users/user.entity';
import { In } from 'typeorm';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
    // Find users by their IDs
    // TODO: argue about this
    const users = await this.userRepository.findBy({
      id: In(createGroupDto.userIds),
    });

    const parentGroup = await this.groupRepository.findOneBy({
      id: createGroupDto.parentGroupId,
    });

    const creator = await this.userRepository.findOneBy({
      id: createGroupDto.creatorId,
    });
    //TODO: argue about this, do the same for parent?
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
