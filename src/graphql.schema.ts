
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export enum TweetCategory {
    Sport = "Sport",
    Finance = "Finance",
    Tech = "Tech",
    News = "News"
}

export class CreateGroupInput {
    name?: Nullable<string>;
    userIds?: Nullable<string[]>;
    parentGroupId?: Nullable<string>;
    creatorId: string;
}

export class CreateTweetInput {
    content: string;
    authorId: string;
    hashtags: string[];
    location?: Nullable<string>;
    category?: Nullable<string>;
    parentTweetId?: Nullable<string>;
}

export class UpdateTweetInput {
    content?: Nullable<string>;
    location?: Nullable<string>;
    category?: Nullable<string>;
}

export class UpdateTweetPermissions {
    inheritViewPermissions: boolean;
    inheritEditPermissions: boolean;
    viewPermissionsUserIds: number[];
    viewPermissionsGroupIds: number[];
    editPermissionsUserIds: number[];
    editPermissionsGroupIds: number[];
}

export class CreateUserInput {
    userName?: Nullable<string>;
    firstName?: Nullable<string>;
    lastName?: Nullable<string>;
}

export abstract class IQuery {
    abstract groups(): Nullable<Nullable<Group>[]> | Promise<Nullable<Nullable<Group>[]>>;

    abstract group(id: string): Nullable<Group> | Promise<Nullable<Group>>;

    abstract tweets(): Tweet[] | Promise<Tweet[]>;

    abstract tweet(id: string): Nullable<Tweet> | Promise<Nullable<Tweet>>;

    abstract tweetsByAuthor(authorId: string): Tweet[] | Promise<Tweet[]>;

    abstract canEditTweet(userId: number, tweetId: string): boolean | Promise<boolean>;

    abstract paginateTweets(userId: number, limit: number, page: number): PaginatedTweets | Promise<PaginatedTweets>;

    abstract users(): Nullable<Nullable<User>[]> | Promise<Nullable<Nullable<User>[]>>;

    abstract user(id: string): Nullable<User> | Promise<Nullable<User>>;
}

export abstract class IMutation {
    abstract createGroup(createGroupInput?: Nullable<CreateGroupInput>): Nullable<Group> | Promise<Nullable<Group>>;

    abstract createTweet(createTweetInput: CreateTweetInput): Tweet | Promise<Tweet>;

    abstract updateTweet(id: string, input: UpdateTweetInput): Tweet | Promise<Tweet>;

    abstract removeTweet(id: string): boolean | Promise<boolean>;

    abstract updateTweetPermissions(id: string, userId: string, input: UpdateTweetPermissions): boolean | Promise<boolean>;

    abstract createUser(createUserInput?: Nullable<CreateUserInput>): Nullable<User> | Promise<Nullable<User>>;
}

export class Group {
    id?: Nullable<number>;
    name?: Nullable<string>;
    users?: Nullable<Nullable<User>[]>;
    childGroups?: Nullable<Nullable<Group>[]>;
    parentGroup?: Nullable<Group>;
    creator?: Nullable<User>;
    createdAt?: Nullable<Date>;
    updatedAt?: Nullable<Date>;
}

export abstract class ISubscription {
    abstract groupCreated(): Nullable<Group> | Promise<Nullable<Group>>;

    abstract userCreated(): Nullable<User> | Promise<Nullable<User>>;
}

export class Tweet {
    id: string;
    content: string;
    authorId: string;
    hashtags: string[];
    location?: Nullable<string>;
    category?: Nullable<TweetCategory>;
    parentTweetId?: Nullable<string>;
    createTime: number;
    updateTime: number;
}

export class PaginatedTweets {
    nodes: Tweet[];
    hasNextPage: boolean;
}

export class User {
    id?: Nullable<number>;
    userName?: Nullable<string>;
    firstName?: Nullable<string>;
    lastName?: Nullable<string>;
}

type Nullable<T> = T | null;
