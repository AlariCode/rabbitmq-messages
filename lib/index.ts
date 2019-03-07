import { IRMQServiceOptions, IRMQConnection, IRMQRouter } from './rmq.interface';
import {
    DISCONNECT_EVENT,
    DISCONNECT_MESSAGE,
    REPLY_QUEUE,
    CONNECTING_MESSAGE,
    CONNECTED_MESSAGE,
    EXCHANGE_TYPE,
    RECONNECT_TIME,
    ERROR_NONE_RPC,
    RMQ_ROUTES_META,
    ERROR_NO_ROUTE,
    ERROR_TIMEOUT,
    TIMEOUT,
} from './constants';
import { EventEmitter } from 'events';
import { Message, Channel } from 'amqplib';
import { Signale } from 'signale';
import { ChannelWrapper, AmqpConnectionManager } from 'amqp-connection-manager';
import * as amqp from 'amqp-connection-manager';
import 'reflect-metadata';

const logger = new Signale({
    config: {
        displayTimestamp: true,
        displayDate: true,
    },
});

export abstract class RMQController {
    private server: AmqpConnectionManager = null;
    private channel: ChannelWrapper = null;
    private options: IRMQServiceOptions;
    private responseEmitter: EventEmitter = new EventEmitter();
    private replyQueue: string = REPLY_QUEUE;
    private router: IRMQRouter[];

    constructor(options: IRMQServiceOptions) {
        this.options = options;
        this.responseEmitter.setMaxListeners(0);
        const metaData = Reflect.getMetadata(RMQ_ROUTES_META, new.target.prototype);
        this.router = metaData ? metaData : [];
        this.init();
    }

    public async init(): Promise<void> {
        logger.watch(CONNECTING_MESSAGE);
        const connectionURLs: string[] = this.options.connections.map((connection: IRMQConnection) => {
            return `amqp://${connection.login}:${connection.password}@${connection.host}`;
        });
        const connectionOptins = {
            reconnectTimeInSeconds: this.options.reconnectTimeInSeconds ? this.options.reconnectTimeInSeconds : RECONNECT_TIME,
        };
        this.server = amqp.connect(connectionURLs, connectionOptins);
        this.channel = this.server.createChannel({
            json: false,
            setup: async (channel: Channel) => {
                await channel.assertExchange(this.options.exchangeName, EXCHANGE_TYPE, { durable: true });
                if (this.options.queueName) {
                    await channel.assertQueue(this.options.queueName, {
                        durable: true,
                        arguments: this.options.queueArguments ? this.options.queueArguments : {},
                    });
                    channel.consume(this.options.queueName, (msg: Message) => this.handleMessage(msg), { noAck: true });
                    if (this.router.length > 0) {
                        this.router.map(async route => {
                            await channel.bindQueue(this.options.queueName, this.options.exchangeName, route.route);
                        });
                    }
                }
                await channel.prefetch(
                    this.options.prefetchCount ? this.options.prefetchCount : 0,
                    this.options.isGlobalPrefetchCount ? this.options.isGlobalPrefetchCount : false,
                );
                channel.consume(this.replyQueue, (msg: Message) => {
                    this.responseEmitter.emit(msg.properties.correlationId, msg);
                }, { noAck: true });
                logger.success(CONNECTED_MESSAGE);
            },
        });

        this.server.on(DISCONNECT_EVENT, err => {
            logger.error(DISCONNECT_MESSAGE);
            logger.error(err.err);
        });
    }

    public async send<IMessage, IReply>(topic: string, message: IMessage): Promise<IReply> {
        return new Promise<IReply>(async (resolve, reject) => {
            if (!this.server || !this.server.isConnected()) {
                await this.init();
            }
            const correlationId = this.generateGuid();
            this.responseEmitter.once(correlationId, (msg: Message) => {
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
            const timeout = this.options.messagesTimeout ? this.options.messagesTimeout : TIMEOUT;
            setTimeout(() => {
                reject(new Error(`${ERROR_TIMEOUT}: ${timeout}`));
            }, timeout);
        });
    }

    public async notify<IMessage>(topic: string, message: IMessage): Promise<void> {
        if (!this.server || !this.server.isConnected()) {
            await this.init();
        }
        this.channel.publish(this.options.exchangeName, topic, Buffer.from(JSON.stringify(message)));
    }

    private async handleMessage(msg: Message): Promise<void> {
        const route = this.router.find(r => r.route === msg.fields.routingKey);
        if (route) {
            const { content } = msg;
            let result;
            try {
                result = await this[route.propertyKey](JSON.parse(content.toString()));
            } catch (err) {
            }
            if (msg.properties.replyTo && result) {
                this.channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(result)), {
                    correlationId: msg.properties.correlationId,
                });
            }
        } else {
            if (msg.properties.replyTo) {
                this.channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify({ error: ERROR_NO_ROUTE })), {
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

export const RMQRoute = (route) => {
    return (target, propertyKey, descriptor) => {
        let routes = Reflect.getMetadata(RMQ_ROUTES_META, target);
        if (!routes) {
            routes = [];
        }
        routes.push({ route, propertyKey });
        Reflect.defineMetadata(RMQ_ROUTES_META, routes, target);
    };
};