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
import { Group } from '../groups/group.entity';

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

  //If provided:
  //- if it is true it means the tweet inherits parent tweets permission. If the tweet has no parent, it means everyone can view this tweet.
  //- if it is false, it means the "viewPermissions" settings will be considered for this Tweet.
  @Column({ default: false })
  inheritViewPermissions: boolean;

  // If provided:
  // - if it is true it means the tweet inherits parent tweets permission. If the tweet has no parent, it means everyone can edit this tweet.
  // - if it is false, it means the "editPermissions" settings will be considered for this Tweet.
  @Column({ default: false })
  inheritEditPermissions: boolean;

  @ManyToMany(() => Group, (group) => group.viewableTweets)
  @JoinTable({ name: 'tweet_viewable_groups' })
  viewableGroups: Group[];

  @ManyToMany(() => Group, (group) => group.editableTweets)
  @JoinTable({ name: 'tweet_editable_groups' })
  EditableGroups: Group[];

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
