var config = require('config');
var child_process = require('child_process');
var http = require('http');
var IRC = require('irc-js');
var querystring = require('querystring');
var util = require('util');

var SERVER = config.SERVER;
var SERVER_PASSWORD = config.SERVER_PASSWORD;
var NICK = config.NICK;
var CHANNEL = config.CHANNEL;
var CHANNEL_KEY = config.CHANNEL_KEY;
var PORT = config.PORT;
var SSL = config.SSL;
var TRIGGER_REGEX = /^js>(.*$)/;

var options = {
  server: SERVER,
  pass: SERVER_PASSWORD,
  port: PORT || 6667,
  ssl: SSL,
  nick: NICK
};

var RPC_HOST = 'localhost';
var RPC_PORT = 8000;
var RPC_PATH = '/';

var BUFFER_SIZE = 421;
var MAX_SCRIPT_RUNTIME = 5000; //in ms

var DEBUGGING = true;
var dbg = function(output){
  if (DEBUGGING) {console.log( output )}
}

// Script
var backend = new Backend();

var irc = new IRC(options);
irc.connect(function(){irc.join(CHANNEL, CHANNEL_KEY);});

irc.on('error', function(err){
	dbg('Got error: '+util.inspect(err));
	dbg('Restarting IRC client');
	try{
		irc.disconnect();
	}
	catch (err) {
		dbg('Disconnect error: '+err);
	}
	irc.connect(function(){irc.join(CHANNEL, CHANNEL_KEY);});
});

irc.on('privmsg', function(msg){
  parseMsgMore(msg);

  var code = getCode(msg.content);
  dbg('Parsed code: '+code);

  if (code) {
    var rpc_options = {
      host: RPC_HOST,
      port: RPC_PORT,
      path: RPC_PATH + '?' + querystring.stringify({
        code: code
      }),
    };
    dbg('Sending GET request with options: '+util.inspect(rpc_options));

    var timeout = setTimeout( backend.restartBackend, MAX_SCRIPT_RUNTIME );
    http.get(rpc_options, function(res){
      var buf = '';
      res.on('data', function(chunk){
        dbg('Got chunk: '+chunk);
        if (!(buf.length > BUFFER_SIZE)) {
          buf += chunk;
        }
      });
      res.on('end', function(){
        clearTimeout( timeout );
        dbg('GET request end');
        irc.privmsg(
          CHANNEL,
          msg.sender + '> ' + sanitizeOutput(buf)
        );
      });
    }).on('error', function(err){
      dbg(err);
      irc.privmsg(
        CHANNEL,
        msg.sender + '> ' + sanitizeOutput(String(err))
      );
    });
  }
});

function parseMsgMore(msg){
  msg.sender = msg.person.nick;
  msg.receiver = msg.params[0];
  msg.content = msg.params[1];
}

function getCode(str){
  var code = str.match( TRIGGER_REGEX );
  return code ? code[1] : false;
}

function limitString(str, maxLen){
  return str.length < maxLen ? str : str.slice(0, maxLen-23) + ' ... (result truncated)';
}

function sanitizeOutput(output){
  var saneOutput = output;
  saneOutput = saneOutput.replace( /\n/g, '\\n' );
  return limitString(saneOutput, BUFFER_SIZE);
}

function Backend(){
  var backend = startBackend();
  this.restartBackend = restartBackend;

  function startBackend(){
    backend = child_process.spawn('node', ['js_rpc.js'], {cwd: process.cwd()});
    return backend;
  }

  function restartBackend(){
    dbg('Restarted backend');
    backend.kill();
    backend = startBackend();
  }
}
