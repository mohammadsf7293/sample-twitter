import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateHashtagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100, { message: 'Hashtag name should not exceed 100 characters' })
  readonly name: string;
}
