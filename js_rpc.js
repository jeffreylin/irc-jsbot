// Dependancies
var http = require('http');
var url = require('url');
var util = require('util');
var vm = require('vm');

// Constants
var HOST = 'localhost';
var PORT = '8000';
var DEBUGGING = true;
var dbg = function(output){
  if (DEBUGGING) {console.log(output);}
}

// Script start
var context = {};
context.GLOBALS = function(){
  return context;
}
context._ = require('underscore');

http.createServer(function( req, res){
  dbg('------------------------');
  dbg(new Date());
  dbg('Requested URL: '+req.url);

  var options = url.parse( req.url, true ).query;
  dbg('Parsed options: '+util.inspect(options));

  if (!options.code) {
    res.writeHead(400);
    res.end();
    return;
  }

  try {
    var output = vm.runInNewContext( options.code, context );
    output = util.inspect(output, false, 0);
  }
  catch (err) {
    var output = err;
  }
  dbg('VM output: '+output);
  res.end( String(output), 'utf-8' );
}).listen( PORT, HOST );
