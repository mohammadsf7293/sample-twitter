import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @IsOptional()
  @IsNumber()
  readonly id?: number;

  @IsString()
  readonly name: string;

  @IsArray()
  @IsNumber({}, { each: true })
  readonly userIds: number[];

  @IsNumber()
  readonly creatorId: number;

  @IsOptional()
  @IsNumber()
  readonly parentGroupId: number | null;
}
