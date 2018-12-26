export interface IRMQServiceOptions {
    exchangeName: string;
    connections: {
        login: string;
        password: string;
        host: string;
    }[];
    queueName?: string;
    prefetchCount?: number;
    isGlobalPrefetchCount?: boolean;
    subscriptions?: string[];
    reconnectTimeInSeconds?: number;
}