import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  ManyToOne,
  JoinTable,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Tweet } from '../tweets/tweet.entity';

@Entity()
export class Group {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // Many-to-Many relationship with User
  @ManyToMany(() => User, (user) => user.groups)
  @JoinTable()
  users: Partial<User>[];

  // Self-referential Many-to-One relationship for the parent group
  // A group can have one parent or be orphan
  @ManyToOne(() => Group, (group) => group.childGroups, { nullable: true })
  @JoinColumn({ name: 'parentGroupId' }) // Foreign key column for the parent
  parentGroup: Group;

  // Self-referential One-to-Many relationship for child groups
  // A group can have multiple children
  @OneToMany(() => Group, (group) => group.parentGroup)
  childGroups: Group[];

  @ManyToMany(() => Tweet, (tweet) => tweet.viewableGroups)
  viewableTweets: Tweet[];

  @ManyToMany(() => Tweet, (tweet) => tweet.editableGroups)
  editableTweets: Tweet[];

  // Many-to-One relationship with User (creator of the group)
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  // Automatically set the creation timestamp
  @CreateDateColumn()
  createdAt: Date;

  // Automatically update the timestamp whenever the entity is updated
  @UpdateDateColumn()
  updatedAt: Date;
}
