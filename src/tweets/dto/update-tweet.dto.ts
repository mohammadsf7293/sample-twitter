import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { TweetCategory } from '../tweet.entity';

export class UpdateTweetDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(TweetCategory)
  @IsOptional()
  category?: TweetCategory;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  hashtags?: string[]; // New field for hashtags
}
