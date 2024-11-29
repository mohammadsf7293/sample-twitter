import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UpdateTweetPermissionsDto {
  @Field()
  inheritViewPermissions: boolean;

  @Field()
  inheritEditPermissions: boolean;

  @Field(() => [Int])
  viewPermissionsUserIds: number[];

  @Field(() => [Int])
  viewPermissionsGroupIds: number[];

  @Field(() => [Int])
  editPermissionsUserIds: number[];

  @Field(() => [Int])
  editPermissionsGroupIds: number[];
}
