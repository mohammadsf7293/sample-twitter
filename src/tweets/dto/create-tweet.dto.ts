import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsArray,
  IsNumber,
} from 'class-validator';
import { TweetCategory } from '../tweet.entity';

export class CreateTweetDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  @IsNotEmpty()
  authorId: number;

  @IsOptional()
  @IsUUID()
  parentTweetId?: string;

  @IsArray()
  @IsString({ each: true })
  hashtags: string[];

  @IsOptional()
  @IsString()
  location?: string;

  @IsEnum(TweetCategory)
  @IsOptional()
  category?: TweetCategory;
}
