import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  CreateDateColumn,
} from 'typeorm';
import { Tweet } from '../tweets/tweet.entity';

@Entity()
export class Hashtag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @ManyToMany(() => Tweet, (tweet) => tweet.hashtags)
  tweets: Tweet[];

  @CreateDateColumn()
  createdAt: Date;
}
