import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
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
}
