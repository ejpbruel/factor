/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const ProcessTransport = require("../lib/transport").ProcessTransport;
const Router = require("../lib/router").Router;
const action = require("../lib/action");
const child_process = require("child_process");
const match = require("../lib/match");

const Action = action.Action;
const arg = match.arg;
const fork = child_process.fork;
const link = action.link;
const receive = action.receive;
const self = action.self;
const send = action.send;
const spawnRemote = action.spawnRemote;
const string = match.string;
const trapError = action.trapError;

/*
 * A simple example of using remote actors with error handling.
 */

function spawnProcess(path) {
  return spawnRemote("process", function (prefix) {
    let process = child_process.fork(path);
    process.send(prefix);
    return new Promise(function (resolve) {
      process.once("message", function (childId) {
        resolve([childId, new ProcessTransport(process)]);
      });
    });
  });
}

function* parent() {
  let selfId = yield self();
  yield trapError(function (actorId, error) {
    return {
      type: "error",
      actorId: actorId,
      error: error.message
    };
  });
  let childId = yield spawnProcess("example6-child.js");
  yield link(childId);
  for (;;) {
    yield send(childId, {
      type: "ping",
      fromId: selfId
    });
    yield receive([{
      type: "pong"
    }, function* () {
      console.log("Received pong.");
    }], [{
      type: "error",
      actorId: arg(string),
      error: arg(string)
    }, function* (actorId, error) {
      console.log("Actor " + actorId + " crashed with error '" + error + "'.");
    }]);
  }
}

let router = new Router();
router.spawn(parent);
