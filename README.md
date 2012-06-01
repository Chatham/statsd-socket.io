# statsd-socket.io [![Build Status](https://secure.travis-ci.org/Chatham/statsd-socket.io.png?branch=master)](http://travis-ci.org/Chatham/statsd-socket.io)

[StatsD](https://github.com/etsy/statsd) backend to emit stats over [socket.io](http://socket.io/). This backend allows you to subscribe to individual stats, groups of stats, or all stats and handle them in real time.

## Installation
There are a few ways to install `statsd-socket.io` to be used as a [StatsD](https://github.com/etsy/statsd) backend. You can add it to the StatsD `package.json` and run `npm install`.

The simplest way to install the module is to run:

```bash
  $ npm install statsd-socket.io
```
## Requirements
* [StatsD](https://github.com/etsy/statsd) >= v0.3.0
* [node.js](http://nodejs.org/) >= v0.6.0

## Configuration
To add this backend to the [StatsD](https://github.com/etsy/statsd) daemon, simply add the following settings to the [StatsD](https://github.com/etsy/statsd) configuration file:
```js
{
  socketPort: 8000,
  backends: ['statsd-socket.io']
}
```
If you want to keep the graphite backend installed, you need to include `'./backends/graphite'` in the backends configuration.

## Usage
```js
var socket = require('socket.io-client').connect('http://localhost:8000');
socket.on('connect', function () {
  socket.emit('subscribe', 'all');
  socket.emit('subscribe', 'gauges.server.cpu');
});

socket.on('all', function (data) {
  console.log('ALL:' + data);
});

socket.on('gauges.server.cpu', function (data) {
  console.log('Server CPU:' + data);
});
```
This example shows using [socket.io](http://socket.io/) on the server side but can just as easily be implemented on the client side. See the [socket.io](http://socket.io/) documentation for more information. 

## Tests
To run the tests:
```js
npm test
```
