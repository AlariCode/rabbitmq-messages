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
    topic: string;
    // tslint:disable-next-line:ban-types
    function: Function;
}