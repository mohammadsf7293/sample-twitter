import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hashtag } from './hashtag.entity';
import { CreateHashtagDto } from './dto/create-hashtag-dto';

@Injectable()
export class HashtagsService {
  constructor(
    @InjectRepository(Hashtag)
    private readonly hashtagRepository: Repository<Hashtag>,
  ) {}

  findAll(): Promise<Hashtag[]> {
    return this.hashtagRepository.find();
  }

  findOne(id: string): Promise<Hashtag> {
    return this.hashtagRepository.findOneBy({ id: id });
  }

  async remove(id: string): Promise<void> {
    await this.hashtagRepository.delete(id);
  }

  async create(createGroupDto: CreateHashtagDto): Promise<Hashtag> {
    const hashtag = new Hashtag();
    hashtag.name = createGroupDto.name;

    return this.hashtagRepository.save(hashtag);
  }
}
