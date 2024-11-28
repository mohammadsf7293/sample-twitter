import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tweet } from './tweet.entity';
import { User } from '../users/user.entity';
import { Hashtag } from './hashtag.entity';
import { CreateTweetDto } from './dto/create-tweet.dto';
import { UpdateTweetDto } from './dto/update-tweet.dto';
import { CacheService } from '../cache/cache.service';
import * as protobuf from 'protobufjs';
import * as path from 'path';

@Injectable()
export class TweetsService {
  [x: string]: any;
  constructor(
    @InjectRepository(Tweet)
    private readonly tweetRepository: Repository<Tweet>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Hashtag)
    private readonly hashtagRepository: Repository<Hashtag>,

    private readonly CacheService: CacheService, // Inject CacheService
  ) {}

  async create(createTweetDto: CreateTweetDto): Promise<Tweet> {
    const { content, authorId, parentTweetId, hashtags, location, category } =
      createTweetDto;

    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new Error('User not found');
    }

    let parentTweet: Tweet = null;
    if (parentTweetId) {
      parentTweet = await this.tweetRepository.findOne({
        where: { id: parentTweetId },
      });
      if (!parentTweet) {
        throw new Error('Parent tweet not found');
      }
    }

    // Handle hashtags: check if they exist, create new ones if needed
    const existingHashtags = await this.hashtagRepository.findBy({
      name: In(hashtags),
    });

    // Find hashtags that are not yet in the database
    const newHashtags = hashtags.filter(
      (hashtag) =>
        !existingHashtags.some((existing) => existing.name === hashtag),
    );

    // Create new hashtags for the ones that don't exist
    const createdHashtags = await Promise.all(
      newHashtags.map(async (hashtagName) => {
        const newHashtag = this.hashtagRepository.create({ name: hashtagName });
        return this.hashtagRepository.save(newHashtag);
      }),
    );

    // Combine existing and new hashtags
    const allHashtags = [...existingHashtags, ...createdHashtags];

    // Create a new tweet entity and populate it with data
    const tweet = new Tweet();
    tweet.content = content;
    tweet.author = author;
    tweet.parentTweet = parentTweet;
    tweet.hashtags = allHashtags;
    tweet.location = location;
    tweet.category = category;

    // Save the tweet to the database
    const savedTweet = await this.tweetRepository.save(tweet);

    // Serialize the tweet to protobuf
    const TweetProto = await protobuf.load(path.join(__dirname, 'tweet.proto'));
    const TweetType = TweetProto.lookupType('Tweet');
    const encodedTweet = TweetType.encode({
      id: savedTweet.id,
      content: savedTweet.content,
      authorId: savedTweet.author.id,
      hashtags: savedTweet.hashtags.map((h) => h.name),
      location: savedTweet.location,
      category: savedTweet.category,
    }).finish();

    const encodedTweetString = encodedTweet.toString();
    // Store serialized tweet in Redis
    await this.CacheService.setValue(
      `cache:tweet:${savedTweet.id}`,
      encodedTweetString,
    );

    return savedTweet;
  }

  findAll(): Promise<Tweet[]> {
    return this.tweetRepository.find({
      relations: ['author', 'hashtags', 'parentTweet', 'childTweets'], // Include relations if needed
    });
  }

  findOne(id: string): Promise<Tweet> {
    return this.tweetRepository.findOne({
      where: { id },
      relations: ['author', 'hashtags', 'parentTweet', 'childTweets'],
    });
  }

  async update(id: string, updateTweetDto: UpdateTweetDto): Promise<Tweet> {
    // Find the existing tweet by id
    const tweet = await this.tweetRepository.findOne({
      where: { id },
      relations: ['hashtags'],
    });
    if (!tweet) {
      throw new Error('Tweet not found');
    }

    // Apply updates from the DTO
    tweet.content = updateTweetDto.content || tweet.content;
    tweet.location = updateTweetDto.location || tweet.location;
    tweet.category = updateTweetDto.category || tweet.category;

    // Handle Hashtags: Find the new hashtags and save them
    const existingHashtags = tweet.hashtags.map((h) => h.name);
    const newHashtags = updateTweetDto.hashtags.filter(
      (hashtag) => !existingHashtags.includes(hashtag),
    );

    // Remove hashtags that are not in the new list
    const hashtagsToRemove = tweet.hashtags.filter(
      (h) => !updateTweetDto.hashtags.includes(h.name),
    );
    await this.hashtagRepository.remove(hashtagsToRemove);

    // Add new hashtags to the database
    const newHashtagEntities = await Promise.all(
      newHashtags.map(async (hashtag) => {
        let existingHashtag = await this.hashtagRepository.findOne({
          where: { name: hashtag },
        });
        if (!existingHashtag) {
          // If the hashtag doesn't exist, create it
          existingHashtag = this.hashtagRepository.create({ name: hashtag });
          await this.hashtagRepository.save(existingHashtag);
        }
        return existingHashtag;
      }),
    );

    // Attach the new hashtags to the tweet
    tweet.hashtags = [
      ...tweet.hashtags.filter((h) => !hashtagsToRemove.includes(h)),
      ...newHashtagEntities,
    ];

    // Save updated tweet in the database
    const updatedTweet = await this.tweetRepository.save(tweet);

    // Now update the cached proto version (same pattern as create method)
    const TweetProto = await protobuf.load(path.join(__dirname, 'tweet.proto')); // Ensure correct path
    const TweetType = TweetProto.lookupType('Tweet'); // Your tweet type as per proto definition

    // Encode updated tweet as per proto schema
    const encodedTweet = TweetType.encode({
      id: updatedTweet.id,
      content: updatedTweet.content,
      authorId: tweet.author.id,
      hashtags: updatedTweet.hashtags.map((h) => h.name),
      location: updatedTweet.location,
      category: updatedTweet.category,
    }).finish();

    // Update the cache with the serialized tweet
    const encodedTweetString = encodedTweet.toString();
    // Store serialized tweet in Redis
    await this.CacheService.setValue(
      `cache:tweet:${updatedTweet.id}`,
      encodedTweetString,
    );

    // Return the updated tweet entity
    return updatedTweet;
  }

  async remove(id: string): Promise<void> {
    const tweet = await this.tweetRepository.findOne({ where: { id } });
    if (!tweet) {
      throw new Error('Tweet not found');
    }
    await this.tweetRepository.remove(tweet);
  }

  findByAuthor(authorId: number): Promise<Tweet[]> {
    return this.tweetRepository.find({
      where: { author: { id: authorId } },
      relations: ['author', 'hashtags', 'parentTweet', 'childTweets'],
    });
  }
}
