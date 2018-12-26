import { IRMQServiceOptions } from './rmq.interface';
import {
    CONNECT_EVENT,
    DISCONNECT_EVENT,
    DISCONNECT_MESSAGE,
    REPLY_QUEUE,
    CONNECTING_MESSAGE,
    CONNECTED_MESSAGE,
    EXCHANGE_TYPE,
    RECONNECT_TIME,
    ERROR_NONE_RPC,
} from './constants';
import { EventEmitter } from 'events';
import { Message, Channel } from 'amqplib';
import { Signale } from 'signale';
import * as amqp from 'amqp-connection-manager';

const logger = new Signale({
    config: {
        displayTimestamp: true,
        displayDate: true,
      },
});

export class RMQService {
    private server: any = null;
    private channel: Channel = null;
    private exchange: any = null;
    private options: IRMQServiceOptions;
    private responseEmitter: EventEmitter;
    private replyQueue: string = REPLY_QUEUE;
    private router: any[] = [];

    constructor(options: IRMQServiceOptions) {
        this.options = options;
    }

    public async init(): Promise<void> {
        logger.watch(CONNECTING_MESSAGE);
        const connectionURLs: string[] = this.options.connections.map(connection => {
            return `amqp://${connection.login}:${connection.password}@${connection.host}`;
        });
        const connectionOptins = {
            reconnectTimeInSeconds: this.options.reconnectTimeInSeconds ? this.options.reconnectTimeInSeconds : RECONNECT_TIME,
        };
        this.server = amqp.connect(connectionURLs, connectionOptins);
        this.server.on(CONNECT_EVENT, () => {
            this.channel = this.server.createChannel({
                json: false,
                setup: async (channel) => {
                    this.exchange = await channel.assertExchange(this.options.exchangeName, EXCHANGE_TYPE, { durable: true });
                    if (this.options.queueName) {
                        await channel.assertQueue(this.options.queueName, { durable: true });
                        channel.consume(this.options.queueName, (msg) => this.handleMessage(msg), { noAck: true });
                        if (this.options.subscriptions) {
                            this.options.subscriptions.map(async sub => {
                                await channel.bindQueue(this.options.queueName, this.options.exchangeName, sub);
                            });
                        }
                    }
                    await channel.prefetch(
                        this.options.prefetchCount ? this.options.prefetchCount : 0,
                        this.options.isGlobalPrefetchCount ? this.options.isGlobalPrefetchCount : false,
                    );
                    this.responseEmitter = new EventEmitter();
                    this.responseEmitter.setMaxListeners(0);
                    channel.consume(this.replyQueue, (msg) => {
                        this.responseEmitter.emit(msg.properties.correlationId, msg);
                    }, { noAck: true });
                    logger.success(CONNECTED_MESSAGE);
                },
            });
        });

        this.server.on(DISCONNECT_EVENT, err => {
            logger.error(DISCONNECT_MESSAGE);
            logger.error(err.err);
        });
    }

    public async send<IMessage, IReply>(topic: string, message: IMessage): Promise<IReply> {
        return new Promise(async (resolve, reject) => {
            if (!this.server || !this.server.isConnected()) {
                await this.init();
            }
            const correlationId = this.generateGuid();
            this.responseEmitter.on(correlationId, msg => {
                const { content } = msg;
                if (content.toString()) {
                    resolve(JSON.parse(content.toString()));
                } else {
                    reject(new Error(ERROR_NONE_RPC));
                }
            });
            this.channel.publish(this.options.exchangeName, topic, Buffer.from(JSON.stringify(message)), {
                replyTo: this.replyQueue,
                correlationId,
            });
        });
    }

    public async notify<IMessage>(topic: string, message: IMessage): Promise<void> {
        if (!this.server || !this.server.isConnected()) {
            await this.init();
        }
        this.channel.publish(this.options.exchangeName, topic, Buffer.from(JSON.stringify(message)));
    }

    public RMQRoute(value: string) {
        return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
            this.router.push({ topic: value, function: descriptor.value });
        };
    }

    private async handleMessage(msg: Message): Promise<void> {
        const route = this.router.find(r => r.topic === msg.fields.routingKey);
        if (route) {
            const { content } = msg;
            const result = await route.function(JSON.parse(content.toString()));
            if (msg.properties.replyTo && result) {
                this.channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(result)), {
                    correlationId: msg.properties.correlationId,
                });
            }
        }
    }

    private generateGuid(): string {
        function s4() {
          return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
        }
        return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
    }
}