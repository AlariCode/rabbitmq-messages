# RabbitMQ RPC library

This library will take care of RPC requests and messaging between microservices. It is easy to bind to our existing controllers to RMQ routes. You can use it with any NodeJS framework.

## Start
First, install the package:

``` bash
npm i rabbitmq-messages
```

Then you need to extend your controller with RMQController:
``` javascript
import { RMQController, RMQRoute } from 'rabbitmq-messages';

export class AppController extends RMQController {
    constructor() {
        super({
            exchangeName: 'my_exchange',
            connections: [{
                login: 'admin',
                password: 'admin',
                host: 'localhost',
            }],
        });
    }
}
```

In super() you pass connection options =:
- **exchangeName** (string) - Exchange that will be used to send messages to.
- **connections** (Object[]) - Array of connection parameters. You can use RQM cluster by using multiple connections.

Additionally, you can use optional parameters:
- **queueName** (string) - Queue name which your microservice would listen and bind topics specified in '@RMQRoute' decorator to this queue. If this parameter is not specified, your microservice could send messages and listen to reply or send notifications, but it couldn't get messages or notifications from other services.
Example:

``` javascript
super({
  exchangeName: 'my_exchange',
  connections: [{
      login: 'admin',
      password: 'admin',
      host: 'localhost',
  }],
  queueName: 'my-service-queue',
})
```
- **prefetchCount** (boolean) - You can read more [here](https://github.com/postwait/node-amqp).
- **isGlobalPrefetchCount** (boolean) - You can read more [here](https://github.com/postwait/node-amqp).
- **reconnectTimeInSeconds** (number) - Time in seconds before reconnection retry. Default is 5 seconds.
- **queueArguments** (object) - You can read more about queue parameters [here](https://www.rabbitmq.com/parameters.html).

## Sending messages
To send message with RPC topic use send() method in your controller or service:
``` javascript
// In TypeScript
this.send<number[], number>('sum.rpc', [1, 2, 3]);
// Or in JavaScript
this.send('sum.rpc', [1, 2, 3]);
```
This method returns a Promise. First type - is a type you send, and the second - you recive.
- 'sum.rpc' - name of subscription topic that you are sending to.
- [1, 2, 3] - data payload.
To get a reply:
``` javascript
this.send('sum.rpc', [1, 2, 3]).then(reply => {
    //...
});
```
If you want to just notify services:
``` javascript
// In TypeScript
this.notify<string>('info.none', 'My data');
// Or in JavaScript
this.notify('info.none', 'My data');
```
This method returns a Promise.
- 'info.none' - name of subscription topic that you are notifying.
- 'My data' - data payload.

## Recieving messages
To listen for messages bind your controller methods to subscription topics with **RMQRoute()** decorator:
``` javascript
export class AppController extends RMQController {

    //...

    @RMQRoute('sum.rpc')
    sum(numbers: number[]): number {
        return numbers.reduce((a, b) => a + b, 0);
    }

    @RMQRoute('info.none')
    info(data: string) {
        console.log(data);
    }
}
```
Return value will be send back as a reply in RPC topic. In 'sum.rpc' example it will send sum of array values. And sender will get `6`:
``` javascript
this.send('sum.rpc', [1, 2, 3]).then(reply => {
    // reply: 6
});
```
Each '@RMQRoute' topic will be automatically bound to queue specified in 'queueName' option.

# Breaking Changes
## v0.5.0
- 'subscriptions' parameters is no longer supported. Queue will be automatically bound to all '@RMQRoute' in RMQController.