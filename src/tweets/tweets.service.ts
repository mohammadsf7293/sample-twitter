import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tweet } from './tweet.entity';
import { User } from '../users/user.entity';
import { Hashtag } from './hashtag.entity';
import { CreateTweetDto } from './dto/create-tweet.dto';
import { UpdateTweetDto } from './dto/update-tweet.dto';

@Injectable()
export class TweetsService {
  constructor(
    @InjectRepository(Tweet)
    private readonly tweetRepository: Repository<Tweet>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Hashtag)
    private readonly hashtagRepository: Repository<Hashtag>,
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
    return this.tweetRepository.save(tweet);
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
    const tweet = await this.tweetRepository.findOne({ where: { id } });
    if (!tweet) {
      throw new Error('Tweet not found');
    }

    // Apply updates from the DTO
    tweet.content = updateTweetDto.content || tweet.content;
    tweet.location = updateTweetDto.location || tweet.location;
    tweet.category = updateTweetDto.category || tweet.category;

    // Save updated tweet
    return this.tweetRepository.save(tweet);
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
