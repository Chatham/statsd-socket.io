# statsd-socket.io [![Build Status](https://secure.travis-ci.org/Chatham/statsd-socket.io.png?branch=master)](http://travis-ci.org/Chatham/statsd-socket.io)

[StatsD](https://github.com/etsy/statsd) backend to emit stats over [socket.io](http://socket.io/)

## Installation
There are a few ways to install `statsd-socket.io` to be used with StatsD. You can add it to the StatsD `package.json` and run `npm install`.

To simply install the module, just run:

```bash
  $ npm install statsd-socket.io
```
## Requirements
* [StatsD](https://github.com/etsy/statsd) >= v0.3.0

## Configuration
To add this backend to the [StatsD](https://github.com/etsy/statsd) daemon, simply add the following settings to you [StatsD](https://github.com/etsy/statsd) configuration file:

```js
{
  socketPort: <port>,
  backends: ['statsd-socket.io']
}
```
__NOTE:__ If you want to keep the graphite backend installed, you need to include `'./backends/graphite'` in the backends array

## Example Usage

```js
var socket = require('socket.io-client').connect('http://localhost:5555')
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

## Tests
To run the tests:

```js
npm test
```
