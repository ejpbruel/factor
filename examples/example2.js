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
 * A simple example of using actors as state machines.
 */

function* parent() {
  let selfId = yield self();
  for (let index = 0; index < 10; index += 1) {
    let childId = router.spawn(child);
    yield send(childId, selfId);
  }
  return detached();
}

function* detached() {
  yield receive([{
    type: "attach",
    parentId: arg(string)
  }, function* (parentId) {
    yield send(parentId, {
      type: "attached"
    });
  }]);
  return attached();
}

function* attached() {
  yield receive([{
    type: "detach",
    parentId: arg(string)
  }, function* (parentId) {
    yield send(parentId, {
      type: "detached"
    });
  }]);
  return detached();
}

function* child() {
  let selfId = yield self();
  let parentId = yield receive([arg(string), function* (parentId) {
    return Action.return(parentId);
  }]);

  yield wait(timeout(Math.floor(Math.random() * 1000)));
  yield send(parentId, {
    type: "attach",
    parentId: selfId
  });
  yield receive([{
    type: "attached"
  }, function* () {}]);
  console.log("Actor " + selfId + " is attached.");

  yield wait(timeout(Math.floor(Math.random() * 1000)));
  yield send(parentId, {
    type: "detach",
    parentId: selfId
  });
  yield receive([{
    type: "detached"
  }, function* () {}]);
  console.log("Actor " + selfId + " is detached.");
}

let router = new Router();
let parentId = router.spawn(parent);
