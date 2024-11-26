import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from '../groups/group.entity';
import { User } from 'src/users/user.entity';
import { DateScalar } from '../common/scalars/date.scalar';
import { Hashtag } from './hashtag.entity';
import { Tweet } from './tweet.entity';
import { TweetsService } from './tweets.service';
import { TweetsResolver } from './tweets.resolver';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, User, Hashtag, Tweet]),
    UsersModule,
  ],
  //TODO: update providers and exports
  providers: [TweetsService, TweetsResolver, DateScalar],
  exports: [TweetsService, TweetsResolver],
})
export class TweetsModule {}
