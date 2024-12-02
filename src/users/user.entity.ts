import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Group } from '../groups/group.entity';
import { Tweet } from '../tweets/tweet.entity';

@Entity()
@Unique(['userName'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userName: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ default: true })
  isActive: boolean;

  // Many-to-Many relationship with Group
  @ManyToMany(() => Group, (group) => group.users)
  groups: Group[];

  @OneToMany(() => Tweet, (tweet) => tweet.author)
  tweets: Tweet[];

  // Automatically set the creation timestamp
  @CreateDateColumn()
  createdAt: Date;

  // Automatically update the timestamp whenever the entity is updated
  @UpdateDateColumn()
  updatedAt: Date;
}
