import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tweet, TweetCategory } from './tweet.entity';
import { TweetKey } from '../cache/cache.service';
import { Hashtag } from './hashtag.entity';
import { CreateTweetDto } from './dto/create-tweet.dto';
import { UpdateTweetDto } from './dto/update-tweet.dto';
import { CacheService } from '../cache/cache.service';
import { Group } from '../groups/group.entity';
import { GroupsService } from '../groups/groups.service';
import { UpdateTweetPermissionsDto } from './dto/update-tweet-permissions.dto';
import { UsersService } from '../users/users.service';
import { FilterTweet } from 'src/graphql.schema';

@Injectable()
export class TweetsService {
  constructor(
    @InjectRepository(Tweet)
    private readonly tweetRepository: Repository<Tweet>,

    @InjectRepository(Hashtag)
    private readonly hashtagRepository: Repository<Hashtag>,

    private readonly groupsService: GroupsService,

    private readonly usersService: UsersService,

    private readonly CacheService: CacheService,
  ) {}

  async create(createTweetDto: CreateTweetDto): Promise<Tweet> {
    const { content, authorId, parentTweetId, hashtags, location, category } =
      createTweetDto;

    // Validate the tweet category
    if (!Object.values(TweetCategory).includes(category)) {
      throw new BadRequestException(
        `Invalid category: ${category}. Accepted categories are: ${Object.values(
          TweetCategory,
        ).join(', ')}.`,
      );
    }

    const author = await this.usersService.findOne(authorId);
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

    // Store tweet to author created tweets cache
    await this.CacheService.addUserCreatedTweetToZSet(
      savedTweet.id,
      savedTweet.author.id,
      savedTweet.hashtags.map((hashtag) => hashtag.name),
      savedTweet.category,
      savedTweet.location,
      Math.round(savedTweet.createdAt.getTime() / 1000),
      savedTweet.parentTweet ? savedTweet.parentTweet.id : '-1',
    );

    return savedTweet;
  }

  async cacheTweet(tweet: Tweet): Promise<void> {
    // Only serialize the necessary fields, creating a simplified version of the Tweet
    const tweetData = {
      id: tweet.id,
      content: tweet.content,
      author: tweet.author,
      category: tweet.category,
      hashtags: tweet.hashtags,
      location: tweet.location,
      createdAt: tweet.createdAt.getTime(),
      updatedAt: tweet.updatedAt.getTime(),
    };

    // Serialize the object to JSON
    const encodedTweetString = JSON.stringify(tweetData);

    // Store serialized tweet in Redis using CacheService's cacheTweet method
    await this.CacheService.cacheTweet(tweet.id, encodedTweetString);
  }

  async getCachedTweet(tweetId: string): Promise<Tweet | null> {
    try {
      // Fetch the cached tweet JSON string from Redis
      const cachedTweetData = await this.CacheService.getCachedTweet(tweetId);
      if (!cachedTweetData) {
        return null;
      }

      // Parse the JSON string into an object
      const tweetObject = JSON.parse(cachedTweetData);

      // Convert the plain object to a Tweet entity
      const tweetEntity = new Tweet();
      tweetEntity.id = tweetObject.id;
      tweetEntity.content = tweetObject.content;
      tweetEntity.category = tweetObject.category;
      tweetEntity.location = tweetObject.location;
      tweetEntity.createdAt = new Date(tweetObject.createdAt);
      tweetEntity.updatedAt = new Date(tweetObject.updatedAt);

      tweetEntity.author = tweetObject.author;
      tweetEntity.hashtags = tweetObject.hashtags;

      return tweetEntity;
    } catch (error) {
      console.error(
        `Failed to fetch or decode cached tweet ${tweetId}:`,
        error,
      );
      throw new Error(`Could not retrieve cached tweet: ${error.message}`);
    }
  }

  private async filterTweets(
    tweets: TweetKey[],
    filter: FilterTweet,
  ): Promise<TweetKey[]> {
    return tweets.filter((tweet) => {
      // Check each filter condition
      if (filter.authorId && tweet.authorId.toString() !== filter.authorId) {
        return false;
      }
      if (filter.hashtag && !tweet.hashtags.includes(filter.hashtag)) {
        return false;
      }
      if (
        filter.parentTweetId &&
        tweet.parentTweetId !== filter.parentTweetId
      ) {
        return false;
      }
      if (filter.category && tweet.category !== filter.category) {
        return false;
      }
      if (filter.location && tweet.location !== filter.location) {
        return false;
      }

      return true; // Include tweet if all conditions pass
    });
  }

  async paginateTweets(
    userId: number,
    limit: number,
    page: number,
    filter?: FilterTweet,
  ): Promise<{ nodes: Tweet[]; hasNextPage: boolean }> {

    // Validate the tweet category
    if (
      filter &&
      filter.category &&
      !Object.values(TweetCategory).includes(filter.category)
    ) {
      throw new BadRequestException(
        `Invalid category: ${filter.category}. Accepted categories are: ${Object.values(
          TweetCategory,
        ).join(', ')}.`,
      );
    }

    const user = await this.usersService.findOneWithRelations(userId, [
      'groups',
    ]);
    if (!user) {
      throw new Error('User not found');
    }

    // Determine the starting index for pagination
    const offset = page * limit;

    const nowStamp = Date.now() / 1000;
    // Here we create timeStamp range (creation date range) of tweets we want to fetch
    // These parameters could also be added to GraphQL params if needed
    // toStamp is timestamp to which tweets must be fetched
    const toStamp = nowStamp;
    // fromStamp is timestamp from which tweets must be fetched
    const fromStamp = nowStamp - 7 * 86400;

    // I've considered the limit to fetch items from cache 10 times bigger that the given limit
    // to have more space to find matched tweets if tweet has filters
    let fetchLimit = limit * 10;
    if (!filter) {
      fetchLimit = limit * 2;
    }

    // Fetch tweet IDs (public + private for the user)
    const publicTweetCachedItems =
      await this.CacheService.paginatePublicTweetIds(
        fromStamp,
        toStamp,
        offset,
        fetchLimit,
      );

    let privateTweetCachedItems: TweetKey[] = [];
    for (const group of user.groups) {
      const fetchedItems = await this.CacheService.paginatePrivateTweetIds(
        group.id,
        fromStamp,
        toStamp,
        offset,
        fetchLimit,
      );

      privateTweetCachedItems = [...privateTweetCachedItems, ...fetchedItems];
    }

    const userSelfCreatedTweetCachedItems =
      await this.CacheService.paginateUserCreatedTweetIds(
        userId,
        fromStamp,
        toStamp,
        offset,
        fetchLimit,
      );

    // Combine and deduplicate tweet IDs
    const allTweetCachedItems = [
      ...new Set([
        ...publicTweetCachedItems,
        ...privateTweetCachedItems,
        ...userSelfCreatedTweetCachedItems,
      ]),
    ];

    // Create a map to filter out duplicate items by id
    const uniqueTweetCachedItems = Array.from(
      new Map(allTweetCachedItems.map((item) => [item.id, item])).values(),
    );

    // Sort tweets by createdAt in descending order (based on their score which is tweet's created at stamp stored in cache layer)
    uniqueTweetCachedItems.sort(
      (a, b) => b.creationTimeStamp - a.creationTimeStamp,
    );

    // Filtering tweets
    let filteredUniqueTweetCachedItems = uniqueTweetCachedItems;
    if (filter) {
      filteredUniqueTweetCachedItems = await this.filterTweets(
        uniqueTweetCachedItems,
        filter,
      );
    }

    // Fetch tweets by ID using getCachedTweet
    const tweets = await Promise.all(
      filteredUniqueTweetCachedItems.map((item) =>
        this.getCachedTweet(item.id),
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
    if (!tweet) {
      throw new Error('Tweet not found');
    }

    const user = await this.usersService.findOneWithRelations(userId, [
      'groups',
    ]);
    if (!user) {
      throw new Error('User not found');
    }

    if (userId == tweet.author.id) {
      return true;
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
    }

    return [
      depthLevel,
      viewPermissionsUserIds || [],
      viewPermissionsGroupIds || [],
    ];
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
    }
    return [
      depthLevel,
      editPermissionsUserIds || [],
      editPermissionsGroupIds || [],
    ];
  }

  async updateTweetPermissions(
    tweetId: string,
    updatePermissionsDto: UpdateTweetPermissionsDto,
    userId: number,
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
      relations: [
        'author',
        'viewableGroups',
        'editableGroups',
        'parentTweet',
        'hashtags',
      ],
    });

    if (!tweet) {
      throw new Error('Tweet not found');
    }

    if (tweet.author.id != userId) {
      console.log(
        `Illegal access for updating tweet, userId: ${userId}, authorId: ${tweet.author.id}`,
      );
      throw new Error('You are not the author of this tweet');
    }

    console.log(
      `calling updateTweetPermissions with following data: inheritViewPermissions: ${inheritViewPermissions}, inheritEditPermissions: ${inheritEditPermissions}, viewPermissionUserId: ${viewPermissionsUserIds}, viewPermissionGroupIds: ${viewPermissionsGroupIds}, editPermissionUserIds: ${editPermissionsUserIds}, editPermissionUserIds: ${editPermissionsGroupIds}`,
    );
    let publicViewableTweet = false;
    let publicEditableTweet = false;

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
      console.log(
        `tweet is considered as publicly viewable, tweetId: ${tweet.id}`,
      );
    } else {
      // private tweet
      const [depth, allowedUserIDs, allowedGroupIDs] = tweetViewPermissions;
      // The viewableGroups will only be set if there is no permission inheritance
      if (depth == 0 && (allowedGroupIDs.length > 0 || allowedUserIDs.length)) {
        const groupsToBeSet = await this.assignGroupsToUsers(
          allowedUserIDs,
          allowedGroupIDs,
          tweet.author.id,
        );

        if (groupsToBeSet.length > 0) {
          tweet.viewableGroups = groupsToBeSet;
        }
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
      if (depth == 0 && (allowedGroupIDs.length > 0 || allowedUserIDs.length)) {
        const groupsToBeSet = await this.assignGroupsToUsers(
          allowedUserIDs,
          allowedGroupIDs,
          tweet.author.id,
        );

        if (groupsToBeSet.length > 0) {
          tweet.editableGroups = groupsToBeSet;
        }
      }
    }
    // Save updated tweet permissions
    const updatedTweet = await this.tweetRepository.save(tweet);

    // Updating related caches for view permissions
    if (publicViewableTweet) {
      this.CacheService.addPublicViewableTweetToZSet(
        updatedTweet.id,
        updatedTweet.author.id,
        updatedTweet.hashtags.map((hashtag) => hashtag.name),
        updatedTweet.category,
        updatedTweet.location,
        Math.round(updatedTweet.createdAt.getTime() / 1000),
        updatedTweet.parentTweet ? updatedTweet.parentTweet.id : '-1',
      );
    } else {
      updatedTweet.viewableGroups.forEach((group) => {
        this.CacheService.addPrivateViewableTweetToZSet(
          group.id,
          updatedTweet.id,
          updatedTweet.author.id,
          updatedTweet.hashtags.map((hashtag) => hashtag.name),
          updatedTweet.category,
          updatedTweet.location,
          Math.round(updatedTweet.createdAt.getTime() / 1000),
          updatedTweet.parentTweet ? updatedTweet.parentTweet.id : '-1',
        );
      });
    }

    // Updating related caches for edit permissions
    if (publicEditableTweet) {
      this.CacheService.setTweetIsPublicEditable(updatedTweet.id);
    } else {
      updatedTweet.editableGroups.forEach((group) => {
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

    // Combine the user groups and the explicitly provided groups
    const mergedGroups = [...validUserGroups, ...existingGroups];

    // Ensure there are no duplicates by 'id'
    groupsToAssign = mergedGroups.reduce((acc, group) => {
      if (!acc.some((g) => g.id === group.id)) {
        acc.push(group);
      }
      return acc;
    }, []);

    return groupsToAssign;
  }
}
