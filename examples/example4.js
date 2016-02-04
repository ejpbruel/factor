/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const Router = require("../lib/router").Router;
const action = require("../lib/action");
const match = require("../lib/match");

const Action = action.Action;
const arg = match.arg;
const link = action.link;
const receive = action.receive;
const self = action.self;
const send = action.send;
const spawn = action.spawn;
const string = match.string;
const trapError = action.trapError;

/*
 * A simple example of error handling with actors.
 */

function* parent() {
  for (;;) {
    let selfId = yield self();
    yield trapError(function (actorId, error) {
      return {
        type: "error",
        actorId: actorId,
        error: error.message
      };
    });
    let childId = yield spawn(child);
    yield link(childId);
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

function* child() {
  yield receive([{
    type: "ping",
    fromId: arg(string)
  }, function* (fromId) {
    console.log("Received ping.");
    if (Math.random() < 0.5) {
      throw new Error("OOPS!");
    }
    yield send(fromId, {
      type: "pong"
    });
  }]);
}

let router = new Router();
router.spawn(parent);
