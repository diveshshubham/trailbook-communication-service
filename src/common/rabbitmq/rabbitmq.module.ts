import { Global, Module } from '@nestjs/common';
import { RabbitMQProvider, RabbitMQConnectionProvider, RabbitMQChannelProvider } from './rabbitmq.provider';
import { RabbitMQService } from './rabbitmq.service';

@Global()
@Module({
  providers: [RabbitMQProvider, RabbitMQConnectionProvider, RabbitMQChannelProvider, RabbitMQService],
  exports: [
    RabbitMQService,
    RabbitMQProvider,
    RabbitMQConnectionProvider,
    RabbitMQChannelProvider,
  ],
})
export class RabbitMQModule {}
