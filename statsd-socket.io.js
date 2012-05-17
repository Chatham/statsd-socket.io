var util = require('util');
var vm = require('vm');

var debug;

var emit_stats = function (socket, ts, metrics) {
  socket.emit('timestamp', ts);

  //Convert dot separated metrics into nested object
  ['gauges','timers','counters'].forEach(function (metric_type) {
    metrics[metric_type] = deepen(metrics[metric_type]) || {};
  });

  socket.get('stats', function (err, stats) {
    stats.forEach(function (stat) {
      if (stat == 'all') {
        socket.emit('all', metrics);
      }
      else {
        try {
          var stat_val = vm.runInNewContext(stat, metrics);
          socket.emit(stat, stat_val);
        }
        catch (e) {
          socket.emit(stat, undefined);
        }
      }
    });
  });
};

var deepen = function (o) {
  var oo = {}, t, parts, part;
  for (var k in o) {
    t = oo;
    parts = k.split('.');
    var key = parts.pop();
    while (parts.length) {
      part = parts.shift();
      t = t[part] = t[part] || {};
    }
    t[key] = o[k];
  }
  return oo;
};

exports.init = function (startup_time, config, events) {
  debug = config.debug;

  if (!config.socketPort) {
    util.log('socketPort must be specified');
    return false;
  }

  var io = require('socket.io').listen(config.socketPort);

  if (debug) {
    io.set('log level', 4);
  }
  else {
    io.set('log level', 1);
  }

  io.sockets.on('connection', function (socket) {
    socket.set('stats', []);

    var emitter = function (ts, metrics) {
      emit_stats(socket, ts, metrics);
    };
    events.on('flush', emitter);

    socket.on('subscribe', function (stat) {
      socket.get('stats', function (err, stats) {
        stats.push(stat);
        socket.set('stats', stats);
      });
    });

    socket.on('unsubscribe', function (stat) {
      socket.get('stats', function (err, stats) {
        for (var i = 0; i < stats.length; i++) {
          if (stats[i] == stat) {
            stats.splice(i, 1);
          }
        }
        socket.set('stats', stats);
      });
    });

    socket.on('disconnect', function () {
      events.removeListener('flush', emitter);
    });
  });

  return true;
};
