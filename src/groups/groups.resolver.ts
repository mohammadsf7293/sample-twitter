import { ParseIntPipe } from '@nestjs/common';
import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { Group } from '../graphql.schema';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';

const pubSub = new PubSub();

@Resolver('Group')
export class GroupsResolver {
  constructor(private readonly groupsService: GroupsService) {}

  @Query('groups')
  async getGroups() {
    return this.groupsService.findAll();
  }

  @Query('group')
  async findOneById(
    @Args('id', ParseIntPipe)
    id: number,
  ): Promise<Group> {
    return this.groupsService.findOne(id);
  }

  @Mutation('createGroup')
  async create(@Args('createGroupInput') args: CreateGroupDto): Promise<Group> {
    const createdGroup = await this.groupsService.create(args);
    pubSub.publish('groupCreated', { groupCreated: createdGroup });
    return createdGroup;
  }

  @Subscription('groupCreated')
  userCreated() {
    return pubSub.asyncIterator('groupCreated');
  }
}
