import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from './group.entity';
import { GroupsService } from './groups.service';
import { User } from 'src/users/user.entity';
import { GroupsResolver } from './groups.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([Group, User])],
  providers: [GroupsService, GroupsResolver],
  exports: [GroupsService, GroupsResolver],
})
export class GroupsModule {}
