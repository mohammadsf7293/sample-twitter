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
    const users = await this.userRepository.findBy({
      id: In(createGroupDto.userIds),
    });
    // Find child groups and parent groups by their IDs
    const childGroups = await this.groupRepository.findBy({
      id: In(createGroupDto.childGroupIds),
    });
    const parentGroups = await this.groupRepository.findBy({
      id: In(createGroupDto.parentGroupIds),
    });

    // Create the new group
    const group = new Group();
    group.users = users;
    group.childGroups = childGroups;
    group.parentGroups = parentGroups;

    return this.groupRepository.save(group); // Save the new group to the database
  }
}
