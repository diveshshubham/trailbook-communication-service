import { Global, Module } from '@nestjs/common';
import { S3Provider } from './s3.provider';
import { S3TestController } from './s3-test.controller';


@Global()
@Module({
  providers: [S3Provider],
  exports: [S3Provider],
  controllers: [S3TestController],
})
export class S3Module {}
