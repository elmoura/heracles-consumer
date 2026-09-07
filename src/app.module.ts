import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from '@/config/config';
import { InboundModule } from '@/modules/inbound/inbound.module';

@Module({
  imports: [MongooseModule.forRoot(config.mongoUri), InboundModule],
})
export class AppModule {}
