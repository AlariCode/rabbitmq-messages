export interface IRMQServiceOptions {
    exchangeName: string;
    connections: IConnection[];
    queueName?: string;
    prefetchCount?: number;
    isGlobalPrefetchCount?: boolean;
    subscriptions?: string[];
    reconnectTimeInSeconds?: number;
}

interface IConnection {
    login: string;
    password: string;
    host: string;
}