import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
        });
      },
    },
    CacheService,
  ],
  exports: ['REDIS', CacheService],
})
export class CacheModule {}
