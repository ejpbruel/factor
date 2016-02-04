"use strict";

const ProcessTransport = require("../lib/transport").ProcessTransport;
const Router = require("../lib/router").Router;
const action = require("../lib/action");
const child_process = require("child_process");
const match = require("../lib/match");
const process = require("process");
const router = require("../lib/router");

const Action = action.Action;
const arg = match.arg;
const fork = child_process.fork;
const kill = action.kill;
const receive = action.receive;
const self = action.self;
const send = action.send;
const spawn = action.spawn;
const string = match.string;

function* child() {
  let selfId = yield self();
  yield receive([{
    type: "ping",
    fromId: arg(string)
  }, function* (fromId) {
    console.log("Received ping.");
    return send(fromId, {
      type: "pong"
    });
  }]);
  return child();
}

process.once("message", function (prefix) {
  let router = new Router(prefix, new ProcessTransport(process));
  process.send(router.spawn(child));
});
