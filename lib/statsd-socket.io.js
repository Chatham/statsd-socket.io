var util = require('util');
var vm = require('vm');
var io = require('socket.io');

var debug;

var emit_stats = function (socket, ts, metrics) {
  socket.emit('timestamp', ts);

  var deep_metrics = {};
  ['gauges','timers','counters'].forEach(function (metric_type) {
    deep_metrics[metric_type] = deepen(metrics[metric_type]) || {};
  });

  var sandbox = vm.createContext(deep_metrics);
  socket.get('stats', function (err, stats) {
    stats.forEach(function (stat) {
      if (stat == 'all') {
        socket.emit('all', deep_metrics);
      }
      else {
        var stat_val;
        if (stat.match('[*]')) {
          var parsed = stat.match(/(\w+)\.(.*)$/);
          var metric_type = parsed[1];
          var pattern = parsed[2].replace('*', '\\w+').replace('.', '\\.');

          var re = new RegExp(pattern);
          var matches = {};
          for (var metric in metrics[metric_type]) {
            if (metric.match(re)) {
              matches[metric] = metrics[metric_type][metric];
            }
          }

          if (matches) {
            var match = {};
            match[metric_type] = deepen(matches);
            stat_val = match;
          }
        }
        else {
          try {
            stat_val = vm.runInContext(stat, sandbox);
          }
          catch (e) {}
        }
        socket.emit(stat, stat_val);
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

  io = io.listen(config.socketPort);

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

    socket.on('subscribe', function (stat, callback) {
      socket.get('stats', function (err, stats) {
        stats.push(stat);
        socket.set('stats', stats);

        if (callback) {
          callback('subscribed ' + stat);
        }
      });
    });

    socket.on('unsubscribe', function (stat, callback) {
      socket.get('stats', function (err, stats) {
        for (var i = 0; i < stats.length; i++) {
          if (stats[i] == stat) {
            stats.splice(i, 1);
            socket.set('stats', stats);

            if (callback) {
              callback('unsubscribed ' + stat);
            }
          }
        }

        if (callback) {
          callback('not subscribed to ' + stat);
        }
      });
    });

    socket.on('disconnect', function () {
      events.removeListener('flush', emitter);
    });
  });

  return true;
};
