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