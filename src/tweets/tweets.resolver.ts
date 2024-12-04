import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { TweetsService } from './tweets.service';
import { Tweet } from './tweet.entity';
import {
  FilterTweet,
  Tweet as TweetDTO,
  PaginatedTweets,
} from '../graphql.schema';
import { CreateTweetDto } from './dto/create-tweet.dto';
import { UpdateTweetDto } from './dto/update-tweet.dto';
import { UpdateTweetPermissionsDto } from './dto/update-tweet-permissions.dto';

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

  @Query(() => Boolean, { name: 'canEditTweet' })
  async canEditTweet(
    @Args('userId', { type: () => Number }) userId: number,
    @Args('tweetId', { type: () => String }) tweetId: string,
  ): Promise<boolean> {
    return this.tweetsService.canEdit(userId, tweetId);
  }

  @Query(() => PaginatedTweets)
  async paginateTweets(
    @Args('userId', { type: () => Number }) userId: number,
    @Args('limit', { type: () => Number }) limit: number,
    @Args('page', { type: () => Number }) page: number,
    @Args('filter', { type: () => FilterTweet, nullable: true })
    filter?: FilterTweet,
  ): Promise<PaginatedTweets> {
    const { nodes, hasNextPage } = await this.tweetsService.paginateTweets(
      userId,
      limit,
      page,
      filter,
    );

    // Manually map entities to GraphQL models (if needed)
    const mappedNodes = nodes.map((tweetEntity) =>
      this.toGraphQLTweet(tweetEntity),
    );

    return {
      nodes: mappedNodes,
      hasNextPage,
    };
  }

  private toGraphQLTweet(tweetEntity: Tweet): TweetDTO {
    return {
      id: tweetEntity.id,
      createTime: Math.round(tweetEntity.createdAt.getTime() / 1000),
      updateTime: Math.round(tweetEntity.updatedAt.getTime() / 1000),
      authorId: tweetEntity.author.id.toString(),
      content: tweetEntity.content,
      hashtags: tweetEntity.hashtags.map((hashtag) => hashtag.name),
      parentTweetId: tweetEntity.parentTweet
        ? tweetEntity.parentTweet.id
        : null,
      category: tweetEntity.category,
      location: tweetEntity.location,
    };
  }

  @Mutation(() => Tweet)
  async createTweet(
    @Args('createTweetInput') createTweetDto: CreateTweetDto,
  ): Promise<TweetDTO> {
    const createdTweet = await this.tweetsService.create(createTweetDto);
    return this.toGraphQLTweet(createdTweet);
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

  @Mutation(() => Boolean)
  async updateTweetPermissions(
    @Args('id', { type: () => String }) id: string, // Tweet ID
    @Args('input') updatePermissionsDto: UpdateTweetPermissionsDto, // Permissions DTO
    @Args('userId', { type: () => Number }) userId: number,
  ): Promise<boolean> {
    await this.tweetsService.updateTweetPermissions(
      id,
      updatePermissionsDto,
      userId,
    );
    return true;
  }
}
