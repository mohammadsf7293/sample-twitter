import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from './group.entity';
import { GroupsService } from './groups.service';

@Module({
  imports: [TypeOrmModule.forFeature([Group])], // Register Group entity
  providers: [GroupsService], // Register the GroupsService
  exports: [GroupsService], // Export the service for use in other modules
})
export class GroupsModule {}
