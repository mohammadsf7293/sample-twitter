import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from '../groups/group.entity';

@Entity()
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

  // Automatically set the creation timestamp
  @CreateDateColumn()
  createdAt: Date;

  // Automatically update the timestamp whenever the entity is updated
  @UpdateDateColumn()
  updatedAt: Date;
}
