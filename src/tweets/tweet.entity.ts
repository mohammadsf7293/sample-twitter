import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from '../users/user.entity'; // Assuming the User entity is located in the users directory
import { Hashtag } from './hashtag.entity';

// Define an enum for the tweet categories
export enum TweetCategory {
  Sport = 'Sport',
  Finance = 'Finance',
  Tech = 'Tech',
  News = 'News',
}

@Entity()
export class Tweet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 280 })
  content: string;

  // Many-to-One relation to User (author of the tweet)
  @ManyToOne(() => User, (user) => user.tweets)
  author: User;

  // Self-referencing Many-to-One relationship (parent tweet)
  @ManyToOne(() => Tweet, (tweet) => tweet.childTweets, { nullable: true })
  parentTweet: Tweet;

  // One-to-Many relationship for child tweets
  @OneToMany(() => Tweet, (tweet) => tweet.parentTweet)
  childTweets: Tweet[];

  @ManyToMany(() => Hashtag, (hashtag) => hashtag.tweets)
  @JoinTable()
  hashtags: Hashtag[];

  @Column({ nullable: true })
  location: string;

  @Column({
    type: 'enum',
    enum: TweetCategory,
    default: TweetCategory.News,
  })
  category: TweetCategory;

  // Automatically set the creation timestamp
  @CreateDateColumn()
  createdAt: Date;

  // Automatically update the timestamp whenever the entity is updated
  @UpdateDateColumn()
  updatedAt: Date;
}
