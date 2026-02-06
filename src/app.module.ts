import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { GlobalJwtModule } from './common/jwt/jwt.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/user/users.module';
import { RedisModule } from './common/redis/redis.module';
import { AlbumsModule } from './modules/albums/albums.module';
import { S3Module } from './common/s3/s3.module';
import {S3TestController} from './common/s3/s3-test.controller';
import { MediaModule } from './modules/media/media.module';
import { ReflectionModule } from './modules/reflection/reflection.module';
import { TrailConnectionModule } from './modules/trail-connection/trail-connection.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { PublicAlbumModule } from './modules/public-album/public-album.module';
import { RabbitMQModule } from './common/rabbitmq/rabbitmq.module';



@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri =
          config.get<string>('MONGO_URI') ||
          'mongodb://localhost:27017/trailbook';

        console.log('🟡 Connecting to MongoDB:', uri);

        return {
          uri,
          connectionFactory: (connection) => {
            connection.on('connected', () => {
              console.log('🟢 MongoDB connected');
            });

            connection.on('error', (err) => {
              console.error('🔴 MongoDB connection error:', err);
            });

            connection.on('disconnected', () => {
              console.warn('🟡 MongoDB disconnected');
            });

            return connection;
          },
        };
      },
    }),

    GlobalJwtModule,
    RedisModule,
    RabbitMQModule,
    AuthModule,
    UsersModule,
    AlbumsModule,
    S3Module,
    MediaModule,
    ReflectionModule,
    TrailConnectionModule,
    CommunicationModule,
    PublicAlbumModule,
  ],
  controllers: [AppController,S3TestController],
  providers: [AppService],
})
export class AppModule {}
