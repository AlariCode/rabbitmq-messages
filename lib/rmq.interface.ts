export interface IRMQServiceOptions {
    exchangeName: string;
    connections: IRMQConnection[];
    queueName?: string;
    prefetchCount?: number;
    isGlobalPrefetchCount?: boolean;
    subscriptions?: string[];
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