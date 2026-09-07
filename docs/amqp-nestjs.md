# RabbitMQ no heracles-consumer

## Abordagem

- **Não** usar `amqplib` diretamente para consumir ou abrir conexões.
- **`@golevelup/nestjs-rabbitmq`**: módulo Nest para subscrições em filas, bindings e integração com o ciclo de vida da aplicação (`RabbitMQModule.forRoot` em [`src/modules/inbound/inbound.module.ts`](../src/modules/inbound/inbound.module.ts), `@RabbitSubscribe` nos consumers). O `forRoot` deve ficar no mesmo módulo onde existem handlers; caso contrário o Nest não resolve as dependências internas do `RabbitMQModule`.
- O **`hermes-api`** publica com **`@nestjs/microservices`** (`ClientProxy` + `Transport.RMQ`, exchange **fanout**). O corpo na fila segue o envelope Nest `{ pattern, data }`; o parser [`src/modules/inbound/parse-inbound-payload.ts`](../src/modules/inbound/parse-inbound-payload.ts) aceita esse formato e o JSON cru do contrato `message.inbound.v1`.
- **Logging de consumo:** o [`RabbitConsumerLoggingInterceptor`](../src/shared/rabbit/rabbit-consumer-logging.interceptor.ts) está aplicado ao [`InboundConsumer`](../src/modules/inbound/inbound.consumer.ts) via `@UseInterceptors`. Em cada mensagem regista fila, handler, duração e sucesso ou falha. Com `LOG_RABBIT_PAYLOAD=true`, também regista o payload (com redacção de campos sensíveis e truncagem).

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `LOG_RABBIT_PAYLOAD` | Se `true`, inclui payload redigido nos logs de entrada; caso contrário só resumo (ex.: chaves do objeto) |
| `RABBITMQ_URL` | URI AMQP (obrigatório em produção) |
| `RABBITMQ_WHATSAPP_INBOUND_EXCHANGE` | Nome da exchange fanout (default: `whatsapp.inbound.fanout`) |
| `RABBITMQ_QUEUE_WHATSAPP_INBOUND_PERSIST` | Fila única: persistência inbound + IA em sequência |
| `RABBITMQ_REALTIME_EXCHANGE` | Exchange topic de eventos realtime (`conversation-created`/`message-created`) |

Alinhar sempre com [hermes-api/docs/rabbitmq-topology.md](../../hermes-api/docs/rabbitmq-topology.md).

## Referências

- [NestJS Microservices — RMQ](https://docs.nestjs.com/microservices/rabbitmq)
- Pacote [@golevelup/nestjs-rabbitmq](https://github.com/golevelup/nestjs)
