var util = require('util');
var vm = require('vm');

var debug;

var emit_stats = function (socket, metrics) {
  socket.get('stats', function (err, stats) {
    stats.forEach(function (stat) {
      if (stat == 'all') {
        socket.emit('all', metrics);
      }
      else {
        var stat_val = vm.runInNewContext(stat, metrics);
        socket.emit(stat, stat_val);
      }
    });
  });
};

exports.init = function (startup_time, config, events) {
  debug = config.debug;

  if (!config.socketPort) {
    util.log('socketPort must be specified');
    return false;
  }

  var io = require('socket.io').listen(config.socketPort);
  io.sockets.on('connection', function (socket) {
    socket.set('stats', []);

    var emitter = function (ts, metrics) {
      emit_stats(socket, metrics);
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
