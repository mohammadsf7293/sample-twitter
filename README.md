# Simple Twitter (X) Server Application

## Description

This project is a simplified server application inspired by Twitter (X), focusing on implementing a **permission system** for tweets. It aims to replicate the permission functionalities of Twitter, where the author can control who can view or edit their tweets.  

### Permission System Overview
- **Default Behavior**:  
  - A tweet inherits the parent tweet's permissions.  
  - If a tweet has no parent, it is accessible to everyone, and only the author can edit it.

- **Permissions**:
  - **View**:  
    - The author can add users or groups to the "View" permission list.  
    - Only listed users or group members can see the tweet. Others cannot.  
    - *Auto-Inheritance*: If enabled for a reply tweet, it will inherit the parent tweet's view permissions. Changes to the parent's permissions will reflect on this tweet.  
  - **Edit**:  
    - The author can add users or groups to the "Edit" permission list.  
    - Only listed users or group members can edit the tweet. Others cannot.  
    - *Auto-Inheritance*: Similar to "View" permissions, edit permissions can also inherit from the parent tweet.

---

## System Architecture

### High-Level Overview
<p align="center">
 <img src="https://ipfs.io/ipfs/Qmee9c6QApMcrHuivmBWWYVxK3CKveLSTENLQvtutjTDie" style="width:25vw;" alt="System Architecture" />
</p>

The system leverages **Redis** as a cache mediator to minimize traffic to MySQL servers. If a requested item is not found in the cache, it is fetched from MySQL and subsequently cached.

---
## Considerations
The project is not fully developed yet and is being actively updated. However, this README outlines all the key ideas and considerations regarding system design, scalability, and more. 

The methods described here have been previously implemented in the **Quiz of Kings** game for its news feed. With over 30 million users, this approach successfully ensured low latency for loading feeds, even under high traffic conditions.

In this design, **groups** are the primary mechanism for defining the visibility and editability of tweets. If a user wants to set specific view or edit permissions by assigning a combination of `UserIDs` and `GroupIDs`, the system creates a new group that includes those `UserIDs` and `GroupIDs`. 

The newly created group's ID is then assigned to the tweet's permissions. This approach simplifies the overall design, making it more generalized and easier to manage.

### Future Enhancements

In the future, the list of user-created groups can be displayed in the UI to avoid repeatedly creating groups with the same users or items. Additionally, server-side logic can be implemented to detect and prevent the creation of duplicate groups. If a user attempts to create a group with identical members to an existing one, the system could

## Cache Design

<p align="center">
 <img src="https://ipfs.io/ipfs/Qmd1xhbQ694WtUvtB56K2HDXCE3jqeHJQQ1f42ic2Z91ax" style="width:45vw;" alt="Cache Architecture" />
</p>

### Redis Cache
- **Structure**:
  - Each tweet is serialized using **protobuf** and stored in Redis with a key: `tweet:proto:$tweetID`.
  - A **TTL (Time-To-Live)** is assigned to cached tweets to ensure only relevant data is stored.
  - Cache updates occur during tweet creation or modification.  

- **Cache Miss Handling**:  
  If a tweet is not found in Redis, it is retrieved from MySQL and cached again.

- **Cache Refresh Policy**:  
  When a tweet is viewed, its TTL is extended to improve access speed for a period after the view.

---

## Feed Creation

### Steps to Build a Feed
1. **Retrieve Public Tweet IDs**:  
   Fetch public tweets the user can see (paginated).  
2. **Retrieve Private Tweet IDs**:  
   Fetch private tweets the user is permitted to access.  
3. **Merge and Sort**:  
   Combine public and private tweets, sorted by timestamp.  
4. **Apply Filters**:  
   Filter tweets based on criteria such as hashtags or categories.  
5. **Paginate the Feed**:  
   Prepare the feed and deliver it to the user.

### Optimized Approach
Instead of querying MySQL for every user feed request:
1. Use **Redis ZSETs (Sorted Sets)** for public tweets:  
   - Example query:  
     ```redis
     ZRANGEBYSCORE tweets:public $min $max WITHSCORES LIMIT $offset $count
     ```
     - `$min` and `$max` define the time range.  
     - `$offset` and `$count` handle pagination.  

2. **Chunking Keys**:  
   Divide public tweet data into chunks for scalability. Examples:  
   - Monthly: `tweets:public:2024_10`  
   - Weekly: `tweets:public:2024_10_1`  
   - Daily: `tweets:public:2024_10_01`  

---

## Private Tweet Handling

- **User Groups**:  
  Redis Sets are used to cache group IDs for each user.  
  - If the cache is empty, the group data is fetched from MySQL and stored in Redis.  
  - For new users, a placeholder key can indicate recent database queries to avoid repeated checks.  

- **Private Tweet Retrieval**:  
  Similar to public tweets, private tweets for groups are stored in **Redis ZSETs**.  
  - Large datasets are chunked into separate keys based on time.  

---

## Final Feed Construction

1. Merge private and public tweet lists based on timestamps.  
2. Fetch the serialized tweet data (protobuf) from Redis for each tweet.  
3. Serve the final feed to the user with minimal MySQL dependency.

---

### Future Improvements

To further enhance the system's scalability and performance, the following improvements can be implemented:

- **Enhanced Chunking Strategies**: Develop more advanced chunking methods for Redis keys to ensure efficient data retrieval and management.  
- **Optimized Feed Filtering**: Refine feed filtering mechanisms to cater to advanced user preferences, such as custom hashtags, categories, or other criteria.  
- **Redis Clustering**: Transition to Redis clustered deployments with replicas for each master node, ensuring higher availability and fault tolerance.  
- **MySQL Partitioning**: Partition MySQL tables based on time, with a robust policy for removing old partitions after creating backups. This keeps database performance optimal and reduces the need for scaling resources.  
- **Sharded and Replicated MySQL**: Scale MySQL by implementing sharding and replication. Tools like [Vitess](https://vitess.io) can be used to manage large-scale MySQL deployments effectively.

### Setup Instructions

Before running the project, ensure that both **MySQL** and **Redis** are up and running as defined in the `docker-compose.yml` file. 

You can start them by running the following command:

```bash
docker-compose up -d
```
Then you should install project dependencies via `yarn` using the following command:
```bash
yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Updating the GraphQL Main Schema

If you make any changes to the `*.graphql` files in any module, you will need to update the main (merged) auto-generated GraphQL schema. To do this, run the following command:

```bash
yarn generate:typings
```

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
yarn install -g mau
mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).