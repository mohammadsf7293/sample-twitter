import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateTweetPermissionsDto {
  @Field()
  inheritViewPermissions: boolean;

  @Field()
  inheritEditPermissions: boolean;

  @Field(() => [String])
  viewPermissions: string[];

  @Field(() => [String])
  editPermissions: string[];
}
