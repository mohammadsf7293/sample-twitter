import { IsString, IsOptional, IsEnum } from 'class-validator';
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
}
