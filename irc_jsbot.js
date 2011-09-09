var config = require('./config');
var http = require('http');
var IRC = require('irc-js');
var querystring = require('querystring');
var util = require('util');

var SERVER = config.SERVER;
var NICK = config.NICK;
var CHANNEL = config.CHANNEL;
var TRIGGER_REGEX = /^js>(.*$)/;

var options = {
  server: SERVER,
  nick: NICK
};

var RPC_HOST = 'localhost';
var RPC_PORT = 8000;
var RPC_PATH = '/';

var BUFFER_SIZE = 421;

var DEBUGGING = true;
var dbg = function(output){
  if (DEBUGGING) {console.log( output )}
}

// Script
var irc = new IRC(options);
irc.connect(function(){irc.join(CHANNEL);});

irc.on('privmsg', function(msg){
  try {
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

      http.get(rpc_options, function(res){
        var buf = '';
        res.on('data', function(chunk){
          dbg('Got chunk: '+chunk);
          if (!(buf.length > BUFFER_SIZE)) {
            buf += chunk;
          }
        });
        res.on('end', function(){
          dbg('GET request end');
          irc.privmsg(
            CHANNEL,
            msg.sender + '> ' + sanitizeOutput(buf)
          );
        });
      });
    }
  }
  catch (err) {
    dbg(err);
    irc.privmsg( CHANNEL, 'error. =[' );
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
