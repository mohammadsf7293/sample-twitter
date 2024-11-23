import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @IsOptional() // Make it optional if you want to let the database generate it
  @IsNumber()
  readonly id?: number;

  @IsArray()
  @IsString({ each: true })
  readonly userIds: number[]; // User IDs array

  @IsArray()
  @IsNumber({}, { each: true })
  readonly childGroupIds: number[]; // Child Group IDs array

  @IsArray()
  @IsNumber({}, { each: true })
  readonly parentGroupIds: number[]; // Parent Group IDs array
}
