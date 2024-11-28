import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: () => {
        return new Redis({
          host: '127.0.0.1',
          port: 6379,
        });
      },
    },
    CacheService,
  ],
  exports: ['REDIS', CacheService],
})
export class CacheModule {}
