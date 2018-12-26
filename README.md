# RabbitMQ RPC library

This library will take care of RPC requests and messaging between microservices. It is easy to bind to our existing controllers to RMQ routes. You can use it with any NodeJS framework.

## Start
First, install the package:

``` bash
npm i rabbitmq-messages
```

Then you need to add new connections with options:
``` javascript
const rmqConnection = new RMQService({
  exchangeName: 'my_exchange',
  connections: [{
      login: 'admin',
      password: 'admin',
      host: 'localhost',
  }],
});
```

Where options are:
- **exchangeName** (string) - Exchange that will be used to send messages to.
- **connections** (Object[]) - Array of connection parameters. You can use RQM cluster by using multiple connections.

Additionally, you can use optional parameters:
- **queueName** (string) - Queue name which your microservice would listen and bind topics specified in subscriptions to this queue. If this parameter is not specified, your microservice could send messages and listen to reply or send notifications, but it couldn't get messages or notifications from other services.
- **subscriptions** (string[]) - Message topics your microservice will subscribe to. It will receive messages only with these topics. Full connection example:

``` javascript
const rmqConnection = new RMQService({
  exchangeName: 'my_exchange',
  connections: [{
      login: 'admin',
      password: 'admin',
      host: 'localhost',
  }],
  queueName: 'my-service-queue',
  subscriptions: [
    'sum.rpc',
    'info.none'
  ],
});
```
- **prefetchCount** (boolean) - You can read more [here](https://github.com/postwait/node-amqp).
- **isGlobalPrefetchCount** (boolean) - You can read more [here](https://github.com/postwait/node-amqp).
- **reconnectTimeInSeconds** (number) - Time in seconds before reconnection retry. Default is 5 seconds.

After adding connection just init it:
``` javascript
rmqConnection.init();
```

## Sending messages
To send message with RPC topic use send() method:
``` javascript
// In TypeScript
rmqConnection.send<number[], number>('sum.rpc', [1, 2, 3]);
// Or in JavaScript
rmqConnection.send('sum.rpc', [1, 2, 3]);
```
This method returns a Promise. First type - is a type you send, and the second - you recive.
- 'sum.rpc' - name of subscription topic that you are sending to.
- [1, 2, 3] - data payload.
To get a reply:
``` javascript
rmqConnection.send('sum.rpc', [1, 2, 3]).then(reply => {
    //...
});
```
If you want to just notify services:
``` javascript
// In TypeScript
rmqConnection.notify<string>('info.none', 'My data');
// Or in JavaScript
rmqConnection.notify('info.none', 'My data');
```
This method returns a Promise.
- 'info.none' - name of subscription topic that you are notifying.
- 'My data' - data payload.

## Recieving messages
To listen for messages bind your functions to subscription topics with **RMQRoute()** decorator:
``` javascript
@rmqConnection.RMQRoute('sum.rpc')
sum(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0);
}

@rmqConnection.RMQRoute('info.none')
info(data: string) {
    console.log(data);
}
```
Return value will be send back as a reply in RPC topic. In 'sum.rpc' example it will send sum of array values. And sender will get `6`:
``` javascript
rmqConnection.send('sum.rpc', [1, 2, 3]).then(reply => {
    // reply: 6
});
```