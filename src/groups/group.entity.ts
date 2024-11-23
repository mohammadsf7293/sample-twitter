import { Entity, PrimaryGeneratedColumn, ManyToMany, JoinTable } from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class Group {
  @PrimaryGeneratedColumn()
  id: number;

  // Many-to-Many relationship with User
  @ManyToMany(() => User, (user) => user.groups)
  @JoinTable() // Specifies the join table for the users relation
  users: Partial<User>[];

  // Self-referential Many-to-Many relationship for child groups
  @ManyToMany(() => Group, (group) => group.parentGroups)
  @JoinTable()
  childGroups: Group[];

  // Self-referential Many-to-Many relationship for parent groups
  @ManyToMany(() => Group, (group) => group.childGroups)
  parentGroups: Group[];
}
