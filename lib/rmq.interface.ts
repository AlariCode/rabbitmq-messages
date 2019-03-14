export interface IRMQServiceOptions {
    exchangeName: string;
    connections: IRMQConnection[];
    queueName?: string;
    queueArguments?: {
        [key: string]: string;
    };
    prefetchCount?: number;
    isGlobalPrefetchCount?: boolean;
    reconnectTimeInSeconds?: number;
    messagesTimeout?: number;
    logLevel?: logLevel;
}

export interface IRMQConnection {
    login: string;
    password: string;
    host: string;
}

export interface IRMQRouter {
    route: string;
    propertyKey: any;
}

export type logLevel = 'info' | 'debug' | 'warn' | 'error';