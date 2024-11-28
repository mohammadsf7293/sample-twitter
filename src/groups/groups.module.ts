import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from './group.entity';
import { GroupsService } from './groups.service';
import { User } from 'src/users/user.entity';
import { GroupsResolver } from './groups.resolver';
import { DateScalar } from '../common/scalars/date.scalar';
import { Tweet } from 'src/graphql.schema';

@Module({
  imports: [TypeOrmModule.forFeature([Group, User, Tweet])],
  providers: [GroupsService, GroupsResolver, DateScalar],
  exports: [GroupsService, GroupsResolver],
})
export class GroupsModule {}
