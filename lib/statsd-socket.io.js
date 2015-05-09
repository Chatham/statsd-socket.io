var util = require('util');
var vm = require('vm');
var io = require('socket.io');
var levelup = require('levelup');
var memdown = require('memdown');

var debug;

var emit_stats = function (socket, ts, metrics) {
  socket.emit('timestamp', ts);

  var deep_metrics = {};
  ['gauges','timers','counters'].forEach(function (metric_type) {
    deep_metrics[metric_type] = deepen(metrics[metric_type]) || {};
  });

  var sandbox = vm.createContext(deep_metrics);
  storage.get([ socket.id, 'stats' ], function (e, stats){
    stats.forEach(function (stat) {
      if (stat == 'all') {
        socket.emit('all', deep_metrics);
      }
      else {
        var stat_val;
        if (stat.match('[*]')) {
          var parsed = stat.match(/(\w+)\.(.*)$/);
          var metric_type = parsed[1];
          var pattern = parsed[2]
            .replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&') // Escape regex characters (excluding *)
            .replace('*', '[\\w-]*'); // Replace wildcard with optional regex word characters

          var re = new RegExp(pattern);
          var matches = {};
          for (var metric in metrics[metric_type]) {
            if (metric.match(re)) {
              matches[metric] = metrics[metric_type][metric];
            }
          }

          if (Object.keys(matches).length) {
            var match = {};
            match[metric_type] = deepen(matches);
            stat_val = match;
          }
        }
        else {
          try {
            var sstat = stat.split('.');
            var match_stat = sstat[0];
            var addl_stat = sstat.slice(1);
            if (addl_stat.length) {
              match_stat += "['" + addl_stat.join("']['") + "']";
            }
            stat_val = vm.runInContext(match_stat, sandbox);
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

var storage = levelup({ db: memdown, keyEncoding: 'json', valueEncoding: 'json' });

exports.init = function (startup_time, config, events) {
  debug = config.debug;

  if (!config.socketPort) {
    util.log('socketPort must be specified');
    return false;
  }

  io = io.listen(config.socketPort);

  if (debug) {
    storage.put('log level', 4, function (){

    });
  }
  else {
    storage.put('log level', 1, function (){

    });
  }

  io.sockets.on('connection', function (socket) {
    storage.put([socket.id, 'stats'], [], function (e) {  })

    var emitter = function (ts, metrics) {
      emit_stats(socket, ts, metrics);
    };
    events.on('flush', emitter);

    socket.on('subscribe', function (stat, callback) {
      storage.get([ socket.id, 'stats' ], function (e, stats){
        stats.push(stat);
        storage.put([ socket.id, 'stats' ], stats, function () {
          callback && callback('subscribed ' + stat);
        });
      });
    });

    socket.on('unsubscribe', function (stat, callback) {
      storage.get([ socket.id, 'stats' ], function (e, stats){
        for (var i = 0; i < stats.length; i++) {
          if (stats[i] == stat) {
            stats.splice(i, 1);
             storage.put([ socket.id, 'stats' ], stats, function () {

              if (callback) {
                callback('unsubscribed ' + stat);
              }
            });
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
