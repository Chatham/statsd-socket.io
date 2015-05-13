var vows = require('vows'),
  assert = require('assert'),
  events = require('events'),
  socket_client = require('socket.io-client'),
  backend = require('../lib/statsd-socket.io');

var ee = new events.EventEmitter();
var testport = 33333;
var debug = false;
var sock = null;

var dummy_metrics = {
  gauges: {
    "server.ABC.cpu": 111,
    "server.ABC.mem": 222,
    "server.ZYX.cpu": 333,
    "server.123.cpu": 444,
    "server.d5460a00-f0ff-11e2-954a-0002a5d5c51b.f81d4fae-7dec-11d0-a765-00a0c91e6bf6.cpu": 987,
    "server.d5460a00-f0ff-11e2-954a-0002a5d5c51b.f81d4fae-7dec-11d0-a765-00a0c91e6bf6.mem": 999
  },
  counters: {
    "counter.abc": 333,
    "counter.zxy": 444,
    "counter.abc-123-zyx": 123,
    "counter1.123": 321
  },
  timers: {
    "timer.abc": [0, 1]
  }
};

var dummy_emit_metrics = {
  "gauges": {
    "server": {
      "ABC": {
        "cpu": 111,
        "mem": 222
      },
      "ZYX": {
        "cpu": 333
      },
      "123": {
        "cpu": 444
      },
      "d5460a00-f0ff-11e2-954a-0002a5d5c51b": {
        "f81d4fae-7dec-11d0-a765-00a0c91e6bf6": {
          "cpu": 987,
          "mem": 999
        }
      }
    }
  },
  "counters": {
    "counter": {
      "abc": 333,
      "zxy": 444,
      "abc-123-zyx": 123
    },
    "counter1":{
      "123": 321
    }
  },
  "timers": {
    "timer": {
      "abc": [0, 1]
    }
  }
};


var flush = function (ts, stats) {
  ['gauges','counters','timers'].forEach(function (metric_type) {
    if (stats[metric_type] === undefined) {
      stats[metric_type] = {};
    }
  });
  ee.emit('flush', ts, stats);
};

var get_timestamp = function () {
  return Math.round(new Date().getTime()/1000.0);
};

var hook_stdout = function (callback) {
  var write = process.stdout.write;

  process.stdout.write = (function (stub) {
    return function (string, encoding, fd) {
      if (debug) {
        stub.apply(process.stdout, arguments);
      }
      callback(string, encoding, fd);
    };
  })(process.stdout.write);

  return function () {
    process.stdout.write = write;
  };
};

var suite = vows.describe('statsd-socket.io');

suite.addBatch({
  'initialize backend with bad config': {
    topic: function () {
      var config = {
        debug: debug
      };

      var stdout_string;
      var unhook = hook_stdout(function (string, encoding, fd) {
        stdout_string = string;
      });
      var rsp = backend.init(new Date(), config, ee);
      unhook();

      return {
        status: rsp,
        stdout: stdout_string
      };
    },

    'returns false': function (rsp) {
      assert.isFalse(rsp.status);
    },

    'error text matches': function (rsp) {
      assert.include(rsp.stdout, 'socketPort must be specified');
    }
  }
});

suite.addBatch({
  'initialize backend with port': {
    topic: function () {
      var config = {
        socketPort: testport,
        debug: debug
      };

      var stdout_string;
      var unhook = hook_stdout(function (string, encoding, fd) {
        stdout_string = string;
      });
      var rsp = backend.init(new Date(), config, ee);
      unhook();

      return rsp;
    },

    'returns true': function (value) {
      assert.isTrue(value);
    }
  }
});

suite.addBatch({
  'connect client to backend socket': {
    topic: function () {
      sock = socket_client('http://127.0.0.1:' + testport);
      sock.on('connect', this.callback);
    },

    'connected': function () {
      //Connected successfully
    }
  }
});

suite.addBatch({
  'subscribe to stat': {
    topic: function () {
      sock.emit('subscribe', 'teststat', this.callback);
    },

    'response string is expected text': function (rsp) {
      assert.equal(rsp, 'subscribed teststat');
    }
  }
});

suite.addBatch({
  'unsubscribed from stat': {
    topic: function () {
      sock.emit('unsubscribe', 'teststat', this.callback);
    },

    'response string is expected text': function (rsp) {
      assert.equal(rsp, 'unsubscribed teststat');
    }
  }
});

suite.addBatch({
  'unsubscribe from non-existent stat': {
    topic: function () {
      sock.emit('unsubscribe', 'bogusstat', this.callback);
    },

    'response string is expected text': function (rsp) {
      assert.equal(rsp, 'not subscribed to bogusstat');
    }
  }
});

suite.addBatch({
  'get flush of all metrics': {
    topic: function () {
      sock.emit('subscribe', 'all', this.callback);
    },

    '': {
      topic: function () {
        sock.on('all', this.callback);

        var ts = get_timestamp();
        flush(ts, dummy_metrics);
      },

      'capture metrics': function (data) {
        sock.emit('unsubscribe', 'all');
        assert.deepEqual(data, dummy_emit_metrics);
      }
    }
  }
});

suite.addBatch({
  'get flush of nested metric': {
    topic: function () {
      sock.emit('subscribe', 'gauges.server.ABC', this.callback);
    },

    '[gauges.server.ABC]': {
      topic: function () {
        sock.on('gauges.server.ABC', this.callback);

        var ts = get_timestamp();
        flush(ts, dummy_metrics);
      },

      'capture metrics': function (data) {
        sock.emit('unsubscribe', 'gauges.server.ABC');
        assert.deepEqual(data, dummy_emit_metrics.gauges.server.ABC);
      }
    }
  }
});

suite.addBatch({
  'get flush of nested numeric key metric': {
    topic: function () {
      sock.emit('subscribe', 'gauges.server.123', this.callback);
    },

    '[gauges.server.123]': {
      topic: function () {
        sock.on('gauges.server.123', this.callback);

        var ts = get_timestamp();
        flush(ts, dummy_metrics);
      },

      'capture metrics': function (data) {
        sock.emit('unsubscribe', 'gauges.server.123');
        assert.deepEqual(data, dummy_emit_metrics.gauges.server['123']);
      }
    }
  }
});

suite.addBatch({
  'get flush of nested uuid key metric': {
    topic: function () {
      sock.emit('subscribe', 'gauges.server.d5460a00-f0ff-11e2-954a-0002a5d5c51b', this.callback);
    },

    '[gauges.server.d5460a00-f0ff-11e2-954a-0002a5d5c51b]': {
      topic: function () {
        sock.on('gauges.server.d5460a00-f0ff-11e2-954a-0002a5d5c51b', this.callback);

        var ts = get_timestamp();
        flush(ts, dummy_metrics);
      },

      'capture metrics': function (data) {
        sock.emit('unsubscribe', 'gauges.server.d5460a00-f0ff-11e2-954a-0002a5d5c51b');
        assert.deepEqual(data, dummy_emit_metrics.gauges.server['d5460a00-f0ff-11e2-954a-0002a5d5c51b']);
      }
    }
  }
});


suite.addBatch({
  'get flush of metric that does not exist': {
    topic: function () {
      sock.emit('subscribe', 'bogusstat', this.callback);
    },

    '[bogusstat]': {
      topic: function () {
        sock.on('bogusstat', this.callback);

        var ts = get_timestamp();
        flush(ts, dummy_metrics);
      },

      'capture metrics': function (data) {
        sock.emit('unsubscribe', 'bogusstat');
        assert.isNull(data);
      }
    }
  }
});

suite.addBatch({
  'get metric for wildcard search': {
    topic: function () {
      sock.emit('subscribe', 'gauges.server.*.cpu', this.callback);
    },

    '[gauges.server.\*.cpu]': {
      topic: function () {
        sock.on('gauges.server.*.cpu', this.callback);

        var ts = get_timestamp();
        flush(ts, dummy_metrics);
      },

      'capture metrics': function (data) {
        sock.emit('unsubscribe', 'gauges.server.*.cpu');
        var expected = {
          'gauges': {
            'server': {
              'ABC': {
                'cpu': dummy_emit_metrics.gauges.server.ABC.cpu
              },
              'ZYX': {
                'cpu': dummy_emit_metrics.gauges.server.ZYX.cpu
              },
              '123': {
                'cpu': dummy_emit_metrics.gauges.server['123']['cpu']
              }
            }
          }
        };

        assert.deepEqual(data, expected);
      }
    }
  }
});

suite.addBatch({
  'get metric for wildcard search with uuid key': {
    topic: function () {
      sock.emit('subscribe', 'gauges.server.d5460a00-f0ff-11e2-954a-0002a5d5c51b.*.cpu', this.callback);
    },

    '[gauges.server.d5460a00-f0ff-11e2-954a-0002a5d5c51b.\*.cpu]': {
      topic: function () {
        sock.on('gauges.server.d5460a00-f0ff-11e2-954a-0002a5d5c51b.*.cpu', this.callback);

        var ts = get_timestamp();
        flush(ts, dummy_metrics);
      },

      'capture metrics': function (data) {
        sock.emit('unsubscribe', 'gauges.server.d5460a00-f0ff-11e2-954a-0002a5d5c51b.*.cpu');
        var expected = {
          'gauges': {
            'server': {
              'd5460a00-f0ff-11e2-954a-0002a5d5c51b': {
                'f81d4fae-7dec-11d0-a765-00a0c91e6bf6': {
                  'cpu': dummy_emit_metrics.gauges.server['d5460a00-f0ff-11e2-954a-0002a5d5c51b']['f81d4fae-7dec-11d0-a765-00a0c91e6bf6']['cpu']
                }
              }
            }
          }
        };

        assert.deepEqual(data, expected);
      }
    }
  }
});

suite.addBatch({
  'get metric for multiple wildcard search': {
    topic: function () {
      sock.emit('subscribe', 'gauges.*.*.*', this.callback);
    },

    '[gauges.*.*.*]': {
      topic: function () {
        sock.on('gauges.*.*.*', this.callback);

        var ts = get_timestamp();
        flush(ts, dummy_metrics);
      },

      'capture metrics': function (data) {
        sock.emit('unsubscribe', 'gauges.*.*.*');
        var expected = {
          'gauges': dummy_emit_metrics.gauges
        };

        assert.deepEqual(data, expected);
      }
    }
  }
});

suite.export(module, {error: false});
