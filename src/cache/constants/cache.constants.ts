export const CacheKeys = {
  PUBLIC_VIEWABLE_TWEETS_ZSET: 'tweets:public',
  PUBLIC_EDITABLE_TWEET_PREFIX: 'tweet:public-editable:',
};

const DAY_TTL = 86400;
export const CacheKeysTTLs = {
  PUBLIC_VIEWABLE_TWEETS_ZSET: 1 * 365 * DAY_TTL,
  PUBLIC_EDITABLE_TWEET: 30 * DAY_TTL,
};
