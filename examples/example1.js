/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const Router = require("../lib/router").Router;
const action = require("../lib/action");
const match = require("../lib/match");

const Action = action.Action;
const arg = match.arg;
const kill = action.kill;
const receive = action.receive;
const self = action.self;
const send = action.send;
const spawn = action.spawn;
const string = match.string;
const timeout = action.timeout;
const wait = action.wait;

/*
 * A simple example of sending messages between actors.
 */

function* parent() {
  let selfId = yield self();
  let childId = yield spawn(child);
  for (;;) {
    yield wait(timeout(Math.floor(Math.random() * 1000)));
    yield send(childId, {
      type: "parent",
      parentId: selfId
    });
    yield receive([{
      type: "child"
    }, function* () {
      console.log("Received child.");
    }]);
  }
}

function* child() {
  let selfId = yield self();
  for (;;) {
    yield receive([{
      type: "parent",
      parentId: arg(string)
    }, function* (parentId) {
      console.log("Received parent.");
      yield wait(timeout(Math.floor(Math.random() * 1000)));
      yield send(parentId, {
        type: "child"
      });
    }]);
  }
}

let router = new Router();
router.spawn(parent);
