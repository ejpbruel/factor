/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const Router = require("../lib/router").Router;
const action = require("../lib/action");
const match = require("../lib/match");

const Action = action.Action;
const arg = match.arg;
const receive = action.receive;
const self = action.self;
const send = action.send;
const spawn = action.spawn;
const string = match.string;
const timeout = action.timeout;
const wait = action.wait;

/*
 * A simple example of using actors for scatter gatter operations.
 */

function* parent() {
  let selfId = yield self();
  let childIds = [];
  for (let index = 0; index < 10; index += 1) {
    childIds[index] = yield spawn(child);
  }

  for (let index = 0; index < 10; index += 1) {
    yield send(childIds[index], {
      type: "request",
      fromId: selfId
    });
  }

  for (let index = 0; index < 10; index += 1) {
    yield receive([{
      type: "response",
      fromId: arg(string)
    }, function* (fromId) {
      console.log("Received response from actor " + fromId + ".");
    }]);
  }

  console.log("Received all responses.");
}

function* child() {
  let selfId = yield self();
  yield receive([{
    type: "request",
    fromId: arg(string)
  }, function* (fromId) {
    console.log("Actor " + selfId + " received request.");
    yield wait(timeout(Math.floor(Math.random() * 1000)));
    return send(fromId, {
      type: "response",
      fromId: selfId
    });
  }]);
}

let router = new Router();
router.spawn(parent);
