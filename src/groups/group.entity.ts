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
} from 'typeorm';
import { User } from '../users/user.entity';

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

  // Self-referential Many-to-Many relationship for child groups
  @ManyToMany(() => Group, (group) => group.parentGroups)
  @JoinTable()
  childGroups: Group[];

  // Self-referential Many-to-Many relationship for parent groups
  @ManyToMany(() => Group, (group) => group.childGroups)
  parentGroups: Group[];

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
