import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tweet } from './tweet.entity';
import { User } from '../users/user.entity';
import { Hashtag } from './hashtag.entity';
import { CreateTweetDto } from './dto/create-tweet.dto';
import { UpdateTweetDto } from './dto/update-tweet.dto';
import { CacheService } from '../cache/cache.service';
import * as protobuf from 'protobufjs';
import * as path from 'path';
import { Group } from '../groups/group.entity';
import { GroupsService } from '../groups/groups.service';
import { UpdateTweetPermissionsDto } from './dto/update-tweet-permissions.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class TweetsService {
  constructor(
    @InjectRepository(Tweet)
    private readonly tweetRepository: Repository<Tweet>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Hashtag)
    private readonly hashtagRepository: Repository<Hashtag>,

    private readonly groupsService: GroupsService,

    private readonly usersService: UsersService,

    private readonly CacheService: CacheService,
  ) {}

  async create(createTweetDto: CreateTweetDto): Promise<Tweet> {
    const { content, authorId, parentTweetId, hashtags, location, category } =
      createTweetDto;

    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new Error('User not found');
    }

    let parentTweet: Tweet = null;
    if (parentTweetId) {
      // Ensure parentTweetId is a number if your 'id' field in Tweet is a number
      parentTweet = await this.tweetRepository.findOne({
        where: { id: parentTweetId }, // Convert to number
      });
      if (!parentTweet) {
        throw new Error('Parent tweet not found');
      }
    }

    // Handle hashtags: check if they exist, create new ones if needed
    const existingHashtags =
      (await this.hashtagRepository.findBy({
        name: In(hashtags),
      })) || [];

    // Find hashtags that are not yet in the database
    const newHashtags = hashtags.filter(
      (hashtag) =>
        !existingHashtags.some((existing) => existing.name === hashtag),
    );

    // Create new hashtags for the ones that don't exist
    const createdHashtags = await Promise.all(
      newHashtags.map(async (hashtagName) => {
        const newHashtag = this.hashtagRepository.create({ name: hashtagName });
        return this.hashtagRepository.save(newHashtag);
      }),
    );

    // Combine existing and new hashtags
    const allHashtags = [...existingHashtags, ...createdHashtags];

    // Create a new tweet entity and populate it with data
    const tweet = new Tweet();
    tweet.content = content;
    tweet.author = author;
    tweet.parentTweet = parentTweet;
    tweet.hashtags = allHashtags;
    tweet.location = location;
    tweet.category = category;

    // Save the tweet to the database
    const savedTweet = await this.tweetRepository.save(tweet);

    // Cache the serialized tweet using the new cacheTweet method
    await this.cacheTweet(savedTweet);

    return savedTweet;
  }

  async cacheTweet(tweet: Tweet): Promise<void> {
    // Serialize the tweet to protobuf
    let protoPath = path.join(__dirname, '../../../src/tweets/tweet.proto');
    switch (process.env.NODE_ENV) {
      case 'production':
        protoPath = path.join(__dirname, 'tweets/tweet.proto');
        break;
      case 'test':
        protoPath = path.join(__dirname, 'tweet.proto');
    }

    const TweetProto = await protobuf.load(protoPath);
    const TweetType = TweetProto.lookupType('Tweet');

    const encodedTweet = TweetType.encode({
      id: tweet.id,
      content: tweet.content,
      authorId: tweet.author.id,
      hashtags: tweet.hashtags.map((h) => h.name),
      location: tweet.location,
      category: tweet.category,
    }).finish();

    const encodedTweetString = encodedTweet.toString();

    // Store serialized tweet in Redis using CacheService's cacheTweet method
    await this.CacheService.cacheTweet(tweet.id, encodedTweetString);
  }

  async getCachedTweet(tweetId: string): Promise<Tweet | null> {
    try {
      // Fetch the cached protobuf data
      const cachedTweetData = await this.CacheService.getCachedTweet(tweetId);
      if (!cachedTweetData) {
        return null;
      }

      // Load the Protobuf schema
      let protoPath = path.join(__dirname, '../../../src/tweets/tweet.proto');
      switch (process.env.NODE_ENV) {
        case 'production':
          protoPath = path.join(__dirname, 'tweets/tweet.proto');
          break;
        case 'test':
          protoPath = path.join(__dirname, 'tweet.proto');
      }

      const TweetProto = await protobuf.load(protoPath);
      const TweetType = TweetProto.lookupType('Tweet');

      // Decode the Protobuf data
      const decodedTweet = TweetType.decode(
        Buffer.from(cachedTweetData, 'base64'),
      );
      const tweetObject = TweetType.toObject(decodedTweet, {
        longs: String, // Convert longs to strings if needed
        enums: String, // Convert enums to strings if needed
        defaults: true, // Include default values
      });

      // Convert the plain object to a Tweet entity
      const tweetEntity = new Tweet();
      tweetEntity.id = tweetObject.id;
      tweetEntity.content = tweetObject.content;
      tweetEntity.author = tweetObject.author;
      tweetEntity.hashtags = tweetObject.hashtags.map((name) => ({ name })); // Convert hashtags
      tweetEntity.location = tweetObject.location;
      tweetEntity.category = tweetObject.category;

      return tweetEntity;
    } catch (error) {
      console.error(
        `Failed to fetch or decode cached tweet ${tweetId}:`,
        error,
      );
      throw new Error(`Could not retrieve cached tweet: ${error.message}`);
    }
  }

  async paginateTweets(
    userId: number,
    limit: number,
    page: number,
  ): Promise<{ nodes: Tweet[]; hasNextPage: boolean }> {
    const user = await this.usersService.findOneWithRelations(userId, [
      'groups',
    ]);
    if (!user) {
      throw new Error('User not found');
    }

    // Determine the starting index for pagination
    const offset = (page - 1) * limit;

    const nowStamp = Date.now();
    // Here we create timeStamp range (creation date range) of tweets we want to fetch
    // These parameters could also be added to GraphQL params if needed
    //toStamp is timestamp to which tweets must be fetched
    const toStamp = nowStamp;
    //fromStamp is timestmap from which tweets must be fetched
    const fromStamp = nowStamp - 7 * 86400;

    // Fetch tweet IDs (public + private for the user)
    const publicTweetCachedItems =
      await this.CacheService.paginatePublicTweetIds(
        fromStamp,
        toStamp,
        offset,
        limit,
      );

    let privateTweetCachedItems: { score: number; item: string }[] = [];
    user.groups.forEach(async (group) => {
      const fetchedItems = await this.CacheService.paginatePrivateTweetIds(
        group.id,
        fromStamp,
        toStamp,
        offset,
        limit,
      );

      privateTweetCachedItems = [...privateTweetCachedItems, ...fetchedItems];
    });

    // Combine and deduplicate tweet IDs
    const allTweetCachedItems = [
      ...new Set([...publicTweetCachedItems, ...privateTweetCachedItems]),
    ];

    // Sort tweets by createdAt in descending order (based on their score which is tweet's created at stamp stored in cache layer)
    allTweetCachedItems.sort((a, b) => b.score - a.score);

    // Fetch tweets by ID using getCachedTweet
    const tweets = await Promise.all(
      allTweetCachedItems.map((itemKey) =>
        this.getCachedTweet(itemKey.item.split('_')[0]),
      ),
    );

    // Filter out null results (in case a cached tweet is missing or invalid)
    const validTweets = tweets.filter((tweet) => tweet !== null);

    // Paginate the results
    const paginatedTweets = validTweets.slice(0, limit);

    return {
      nodes: paginatedTweets,
      hasNextPage: validTweets.length > limit,
    };
  }

  findAll(): Promise<Tweet[]> {
    return this.tweetRepository.find({
      relations: ['author', 'hashtags', 'parentTweet', 'childTweets'], // Include relations if needed
    });
  }

  findOne(id: string): Promise<Tweet> {
    return this.tweetRepository.findOne({
      where: { id },
      relations: ['author', 'hashtags', 'parentTweet', 'childTweets'],
    });
  }

  async update(id: string, updateTweetDto: UpdateTweetDto): Promise<Tweet> {
    // Find the existing tweet by id
    const tweet = await this.tweetRepository.findOne({
      where: { id },
      relations: ['hashtags'],
    });
    if (!tweet) {
      throw new Error('Tweet not found');
    }

    // Apply updates from the DTO
    tweet.content = updateTweetDto.content || tweet.content;
    tweet.location = updateTweetDto.location || tweet.location;
    tweet.category = updateTweetDto.category || tweet.category;

    // Handle Hashtags: Find the new hashtags and save them
    const existingHashtags = tweet.hashtags.map((h) => h.name);
    const newHashtags = updateTweetDto.hashtags.filter(
      (hashtag) => !existingHashtags.includes(hashtag),
    );

    // Remove hashtags that are not in the new list
    const hashtagsToRemove = tweet.hashtags.filter(
      (h) => !updateTweetDto.hashtags.includes(h.name),
    );
    await this.hashtagRepository.remove(hashtagsToRemove);
    //TODO: Move this part(and all hashtag related parts) to hashtags service and develop tests for it
    // Add new hashtags to the database
    const newHashtagEntities = await Promise.all(
      newHashtags.map(async (hashtag) => {
        let existingHashtag = await this.hashtagRepository.findOne({
          where: { name: hashtag },
        });
        if (!existingHashtag) {
          // If the hashtag doesn't exist, create it
          existingHashtag = this.hashtagRepository.create({ name: hashtag });
          await this.hashtagRepository.save(existingHashtag);
        }
        return existingHashtag;
      }),
    );

    // Attach the new hashtags to the tweet
    tweet.hashtags = [
      ...tweet.hashtags.filter((h) => !hashtagsToRemove.includes(h)),
      ...newHashtagEntities,
    ];

    // Save updated tweet in the database
    const updatedTweet = await this.tweetRepository.save(tweet);

    // Instead of manually serializing, use the cacheTweet method
    await this.cacheTweet(updatedTweet); // Use the cacheTweet method to handle caching

    // Return the updated tweet entity
    return updatedTweet;
  }

  async remove(id: string): Promise<void> {
    const tweet = await this.tweetRepository.findOne({ where: { id } });
    if (!tweet) {
      throw new Error('Tweet not found');
    }
    await this.tweetRepository.remove(tweet);
  }

  findByAuthor(authorId: number): Promise<Tweet[]> {
    return this.tweetRepository.find({
      where: { author: { id: authorId } },
      relations: ['author', 'hashtags', 'parentTweet', 'childTweets'],
    });
  }

  async canEdit(userId: number, tweetId: string): Promise<boolean> {
    const tweet = await this.tweetRepository.findOne({
      where: { id: tweetId },
      relations: ['author', 'hashtags', 'parentTweet', 'editableGroups'],
    });

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new Error('User not found');
    }

    if (!tweet) {
      throw new Error('Tweet not found');
    }

    const tweetEditPermissions = await this.determineTweetEditability(
      tweet,
      [],
      tweet.editableGroups.map((group) => group.id),
      0,
    );

    if (tweetEditPermissions.length === 2) {
      // Tweet is public editable
      return true;
    } else if (tweetEditPermissions.length === 3) {
      const viewPermissionGroupIds = tweetEditPermissions[2];
      // Check if user belongs to any of the allowed groups
      const isUserInGroup = await this.usersService.isUserInGroupIds(
        user,
        viewPermissionGroupIds,
      );
      return isUserInGroup;
    }

    // Default case: user cannot edit
    return false;
  }

  async determineTweetVisibility(
    tweet: Tweet,
    viewPermissionsUserIds: number[],
    viewPermissionsGroupIds: number[],
    depthLevel: number,
  ): Promise<[number, string] | [number, number[], number[]]> {
    if (tweet.inheritViewPermissions) {
      if (!tweet.parentTweet) {
        return [depthLevel, 'public'];
      } else {
        return await this.determineTweetVisibility(
          tweet.parentTweet,
          [],
          tweet.parentTweet.viewableGroups
            ? tweet.parentTweet.viewableGroups.map((group) => group.id)
            : [],
          depthLevel + 1,
        );
      }
    } else if (
      (viewPermissionsUserIds && viewPermissionsUserIds.length > 0) ||
      (viewPermissionsGroupIds && viewPermissionsGroupIds.length > 0)
    ) {
      return [depthLevel, viewPermissionsUserIds, viewPermissionsGroupIds];
    }

    return [depthLevel, 'public'];
  }

  async determineTweetEditability(
    tweet: Tweet,
    editPermissionsUserIds: number[],
    editPermissionsGroupIds: number[],
    depthLevel: number,
  ): Promise<[number, string] | [number, number[], number[]]> {
    if (tweet.inheritEditPermissions) {
      if (!tweet.parentTweet) {
        return [depthLevel, 'public'];
      } else {
        return await this.determineTweetEditability(
          tweet.parentTweet,
          [],
          tweet.parentTweet.editableGroups
            ? tweet.parentTweet.editableGroups.map((group) => group.id)
            : [],
          depthLevel + 1,
        );
      }
    } else if (
      (editPermissionsUserIds && editPermissionsUserIds.length > 0) ||
      (editPermissionsGroupIds && editPermissionsGroupIds.length > 0)
    ) {
      return [depthLevel, editPermissionsUserIds, editPermissionsGroupIds];
    }

    return [depthLevel, 'public'];
  }

  async updateTweetPermissions(
    tweetId: string,
    updatePermissionsDto: UpdateTweetPermissionsDto,
    authorId: number,
  ): Promise<Tweet> {
    const {
      viewPermissionsUserIds,
      editPermissionsUserIds,
      viewPermissionsGroupIds,
      editPermissionsGroupIds,
      inheritViewPermissions,
      inheritEditPermissions,
    } = updatePermissionsDto;

    // Fetch the tweet
    const tweet = await this.tweetRepository.findOne({
      where: { id: tweetId },
      relations: ['author', 'viewableGroups', 'editableGroups', 'parentTweet'],
    });

    if (!tweet) {
      throw new Error('Tweet not found');
    }

    if (tweet.author.id !== authorId) {
      throw new Error('You are not the author of this tweet');
    }

    let publicViewableTweet = false;
    let publicEditableTweet = false;
    let viewableGroupsToBeSet: Group[] = [];
    let editableGroupsToBeSet: Group[] = [];

    tweet.inheritViewPermissions = inheritViewPermissions;
    const tweetViewPermissions = await this.determineTweetVisibility(
      tweet,
      viewPermissionsUserIds,
      viewPermissionsGroupIds,
      0,
    );
    if (tweetViewPermissions.length == 2) {
      // public tweet
      publicViewableTweet = true;
    } else {
      // private tweet
      const [depth, allowedUserIDs, allowedGroupIDs] = tweetViewPermissions;
      // The viewableGroups will only be set if there is no permission inheritance
      if (depth == 0) {
        const groupsToBeSet = await this.assignGroupsToUsers(
          allowedUserIDs,
          allowedGroupIDs,
          authorId,
        );
        tweet.viewableGroups = groupsToBeSet;
        viewableGroupsToBeSet = groupsToBeSet;
      }
    }

    tweet.inheritEditPermissions = inheritEditPermissions;
    const tweetEditPermissions = await this.determineTweetEditability(
      tweet,
      editPermissionsUserIds,
      editPermissionsGroupIds,
      0,
    );
    if (tweetEditPermissions.length == 2) {
      // public editable tweet
      publicEditableTweet = true;
    } else {
      // private tweet
      const [depth, allowedUserIDs, allowedGroupIDs] = tweetEditPermissions;
      // The editableGroups will only be set if there is no permission inheritance
      if (depth == 0) {
        const groupsToBeSet = await this.assignGroupsToUsers(
          allowedUserIDs,
          allowedGroupIDs,
          authorId,
        );
        tweet.editableGroups = groupsToBeSet;
        editableGroupsToBeSet = groupsToBeSet;
      }
    }
    // Save updated tweet permissions
    const updatedTweet = await this.tweetRepository.save(tweet);

    // Updating related caches for view permissions
    if (publicViewableTweet) {
      this.CacheService.addPublicViewableTweetToZSet(
        updatedTweet.id,
        updatedTweet.hashtags.map((hashtag) => hashtag.name),
        updatedTweet.category,
        updatedTweet.createdAt.getTime(),
      );
    } else {
      viewableGroupsToBeSet.forEach((group) => {
        this.CacheService.addPrivateViewableTweetToZSet(
          group.id,
          updatedTweet.id,
          updatedTweet.hashtags.map((hashtag) => hashtag.name),
          updatedTweet.category,
          updatedTweet.createdAt.getTime(),
        );
      });
    }

    // Updating related caches for edit permissions
    if (publicEditableTweet) {
      this.CacheService.setTweetIsPublicEditable(updatedTweet.id);
    } else {
      editableGroupsToBeSet.forEach((group) => {
        this.CacheService.setTweetIsEditableByGroup(updatedTweet.id, group.id);
      });
    }

    return updatedTweet;
  }

  // Helper method to assign groups to users (as per your updated logic)
  private async assignGroupsToUsers(
    userIds: number[],
    groupIds: number[],
    authorId: number,
  ): Promise<Group[]> {
    let groupsToAssign: Group[] = [];

    // Find groups by the user IDs using the groups service
    const userGroups = await this.groupsService.findUserGroupsByUserIds(
      userIds,
      authorId,
    );

    // Filter groups to make sure that they only contain the given userIds
    const validUserGroups = userGroups.filter((group) => {
      // Check that the group contains exactly the same set of users as userIds (no extra users)
      return (
        group.users.every((user) => userIds.includes(user.id)) &&
        userIds.every((userId) =>
          group.users.map((user) => user.id).includes(userId),
        )
      );
    });

    // If no valid user groups are found, create a new group with userIds
    if (validUserGroups.length === 0) {
      const newGroup = await this.groupsService.create({
        name: 'groupOfUsers',
        userIds: userIds,
        creatorId: authorId,
        parentGroupId: null,
      });
      validUserGroups.push(newGroup);
    }

    // Find groups by the provided group IDs (explicitly given by the author)
    const existingGroups = await this.groupsService.findGroupsByIds(groupIds);

    // Combine the user groups and the explicitly provided groups and ensure there are no duplicates
    groupsToAssign = [...new Set([...validUserGroups, ...existingGroups])];

    return groupsToAssign;
  }
}
