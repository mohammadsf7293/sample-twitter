import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { TweetsService } from './tweets.service';
import { Tweet } from './tweet.entity';
import { CreateTweetDto } from './dto/create-tweet.dto';
import { UpdateTweetDto } from './dto/update-tweet.dto';

@Resolver(() => Tweet)
export class TweetsResolver {
  constructor(private readonly tweetsService: TweetsService) {}

  @Query(() => [Tweet], { name: 'tweets' })
  findAll(): Promise<Tweet[]> {
    return this.tweetsService.findAll();
  }

  @Query(() => Tweet, { name: 'tweet', nullable: true })
  findOne(@Args('id', { type: () => String }) id: string): Promise<Tweet> {
    return this.tweetsService.findOne(id);
  }

  @Query(() => [Tweet], { name: 'tweetsByAuthor' })
  findByAuthor(
    @Args('authorId', { type: () => Number }) authorId: number,
  ): Promise<Tweet[]> {
    return this.tweetsService.findByAuthor(authorId);
  }

  @Mutation(() => Tweet)
  createTweet(
    @Args('createTweetInput') createTweetDto: CreateTweetDto,
  ): Promise<Tweet> {
    return this.tweetsService.create(createTweetDto);
  }

  @Mutation(() => Tweet)
  updateTweet(
    @Args('id', { type: () => String }) id: string,
    @Args('updateTweetDto') updateTweetDto: UpdateTweetDto,
  ): Promise<Tweet> {
    return this.tweetsService.update(id, updateTweetDto);
  }

  @Mutation(() => Boolean)
  async removeTweet(
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    await this.tweetsService.remove(id);
    return true;
  }
}
